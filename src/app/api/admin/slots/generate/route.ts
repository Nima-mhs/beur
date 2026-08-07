import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000;

async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await getServiceClient()
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "admin" ? user : null;
}

// Generates real time_slots rows for the next N weeks from active
// recurring_slot_templates, skipping any that already exist.
export async function POST(request: NextRequest) {
  const admin = await checkAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { weeks } = await request.json().catch(() => ({}));
  const numWeeks = Math.min(Math.max(Number(weeks) || 4, 1), 12);

  const db = getServiceClient();

  const { data: templates, error: templatesError } = await db
    .from("recurring_slot_templates")
    .select("*")
    .eq("active", true);
  if (templatesError) return NextResponse.json({ error: templatesError.message }, { status: 500 });
  if (!templates || templates.length === 0) {
    return NextResponse.json({ created: 0, skipped: 0 });
  }

  const now = new Date();
  const nowTehran = new Date(now.getTime() + TEHRAN_OFFSET_MS);
  const todayStr = nowTehran.toISOString().split("T")[0];

  const rangeEnd = new Date(now.getTime() + numWeeks * 7 * 24 * 60 * 60 * 1000);
  const { data: existing, error: existingError } = await db
    .from("time_slots")
    .select("starts_at")
    .gte("starts_at", now.toISOString())
    .lte("starts_at", rangeEnd.toISOString());
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  const existingTimes = new Set((existing ?? []).map((s) => new Date(s.starts_at).getTime()));

  const toInsert: {
    starts_at: string;
    duration_min: number;
    price_irr: number;
    service: string;
    available: boolean;
  }[] = [];

  for (let offset = 0; offset < numWeeks * 7; offset++) {
    const day = new Date(`${todayStr}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() + offset);
    const dateStr = day.toISOString().split("T")[0];
    const dayOfWeek = day.getUTCDay();

    for (const t of templates) {
      if (t.day_of_week !== dayOfWeek) continue;
      const startsAt = new Date(`${dateStr}T${t.time_of_day}:00+03:30`);
      if (startsAt.getTime() <= now.getTime()) continue;
      if (existingTimes.has(startsAt.getTime())) continue;
      existingTimes.add(startsAt.getTime());
      toInsert.push({
        starts_at: startsAt.toISOString(),
        duration_min: t.duration_min,
        price_irr: t.price_irr,
        service: t.service,
        available: true,
      });
    }
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ created: 0, skipped: 0 });
  }

  const { error: insertError } = await db.from("time_slots").insert(toInsert);
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ created: toInsert.length });
}

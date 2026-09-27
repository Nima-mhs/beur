import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

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

export async function GET() {
  const admin = await checkAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = getServiceClient();
  const now = new Date().toISOString();

  // Auto-cleanup: past slots are useless for booking, so drop them. Slots
  // still referenced by a booking (bookings.slot_id FK, no cascade) are kept
  // for booking history but hidden from this list.
  const { data: pastSlots } = await db
    .from("time_slots")
    .select("id")
    .lt("starts_at", now);
  const pastIds = (pastSlots ?? []).map((s) => s.id);
  if (pastIds.length > 0) {
    const { data: referenced } = await db
      .from("bookings")
      .select("slot_id")
      .in("slot_id", pastIds);
    const referencedIds = new Set((referenced ?? []).map((b) => b.slot_id));
    const deletable = pastIds.filter((id) => !referencedIds.has(id));
    if (deletable.length > 0) {
      await db.from("time_slots").delete().in("id", deletable);
    }
  }

  const { data, error } = await db
    .from("time_slots")
    .select("*")
    .gte("starts_at", now)
    .order("starts_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ slots: data ?? [] });
}

export async function POST(request: NextRequest) {
  const admin = await checkAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { starts_at, duration_min, price_irr } = await request.json();
  if (!starts_at) return NextResponse.json({ error: "Missing starts_at" }, { status: 400 });

  const { data, error } = await getServiceClient()
    .from("time_slots")
    .insert({ starts_at, duration_min: duration_min ?? 60, price_irr: price_irr ?? 5000000, available: true })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ slot: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const admin = await checkAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const db = getServiceClient();

  const { count } = await db
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("slot_id", id);
  if (count && count > 0) {
    return NextResponse.json(
      { error: "این زمان به یک رزرو (حتی لغوشده) متصل است و قابل حذف نیست." },
      { status: 409 },
    );
  }

  const { error } = await db
    .from("time_slots")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

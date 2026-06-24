import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Try server client first, fallback to service client
  const db = getServiceClient();
  const { data: profile } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") return user;

  // Fallback: check via anon client
  const { data: profile2 } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return profile2?.role === "admin" ? user : null;
}

export async function GET() {
  const admin = await checkAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await getServiceClient()
    .from("bookings")
    .select("id, status, service, full_name, email, phone, notes, meeting_link, created_at, time_slots(starts_at, duration_min, price_irr)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bookings: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const admin = await checkAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, status, meeting_link } = await request.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const update: Record<string, string> = {};
  if (status) update.status = status;
  if (meeting_link !== undefined) update.meeting_link = meeting_link;

  const { data, error } = await getServiceClient()
    .from("bookings")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ booking: data });
}

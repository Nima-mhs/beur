import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("bookings")
    .select("id, service, status, full_name, email, phone, notes, created_at, slot_id, time_slots(starts_at, duration_min)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ bookings: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { slot_id, full_name, email, phone, notes } = body;

  if (!slot_id || !full_name || !email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Verify slot is still available
  const { data: slot } = await supabase
    .from("time_slots")
    .select("id, available")
    .eq("id", slot_id)
    .single();

  if (!slot || !slot.available) {
    return NextResponse.json({ error: "Slot no longer available" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      user_id: user.id,
      slot_id,
      service: "personal_color_consultation",
      status: "pending_payment",
      full_name,
      email,
      phone: phone || null,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ booking: data }, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { status } = body;

  if (status !== "cancelled") {
    return NextResponse.json({ error: "Only cancellation is allowed" }, { status: 400 });
  }

  // Ensure booking belongs to user and is cancellable
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, status, user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.status === "cancelled") {
    return NextResponse.json({ error: "Already cancelled" }, { status: 400 });
  }

  if (booking.status === "confirmed") {
    return NextResponse.json({ error: "Confirmed bookings cannot be self-cancelled. Please contact us." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ booking: data });
}

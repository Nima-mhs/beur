import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return NextResponse.json({ role: null });

  const token = authHeader.replace("Bearer ", "");

  const sb = getServiceClient();
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return NextResponse.json({ role: null });

  const { data: profile } = await sb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return NextResponse.json({ role: profile?.role ?? null });
}

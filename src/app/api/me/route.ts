import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return NextResponse.json({ role: null });

  const token = authHeader.replace("Bearer ", "");

  // Verify token using Supabase auth
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ role: null });

  const { data: profile } = await getServiceClient()
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return NextResponse.json({ role: profile?.role ?? null });
}

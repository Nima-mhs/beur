import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "") ?? "";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "MISSING";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "MISSING";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "MISSING";

  const sb = createClient(url, serviceKey);

  const { data: userData, error: userError } = await sb.auth.getUser(token);
  const userId = userData?.user?.id ?? null;

  let profile = null;
  let profileError = null;
  if (userId) {
    const { data, error } = await sb
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .single();
    profile = data;
    profileError = error?.message ?? null;
  }

  return NextResponse.json({
    tokenLength: token.length,
    supabaseUrl: url.slice(0, 30) + "...",
    serviceKeyPrefix: serviceKey.slice(0, 20) + "...",
    anonKeyPrefix: anonKey.slice(0, 20) + "...",
    getUserError: userError?.message ?? null,
    userId,
    userEmail: userData?.user?.email ?? null,
    profile,
    profileError,
  });
}

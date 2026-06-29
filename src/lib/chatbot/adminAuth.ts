/**
 * Shared admin authentication helper for chatbot admin API routes.
 */
import { NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";

export async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const token =
    req.headers.get("Authorization")?.replace("Bearer ", "") ??
    req.cookies.get("sb-access-token")?.value;

  if (!token) return false;

  try {
    const sb = getServiceClient();
    const {
      data: { user },
    } = await sb.auth.getUser(token);
    if (!user) return false;

    const { data } = await sb
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    return data?.role === "admin";
  } catch {
    return false;
  }
}

import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";

// Reads no cookies/headers, so Next.js would otherwise treat this as a static
// route and cache the response at build time — admin edits would never show up.
export const dynamic = "force-dynamic";

// Public: the About page needs this to show the admin-edited photo/bio/résumé.
export async function GET() {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("about_content")
    .select("photo_url,bio,resume_items")
    .eq("id", 1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ content: data });
}

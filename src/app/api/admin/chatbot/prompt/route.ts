import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/chatbot/adminAuth";
import { getServiceClient } from "@/lib/supabase/service";
import { invalidateBrainCache } from "@/lib/chatbot/brain";

export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getServiceClient();
  const { data } = await sb
    .from("prompt_versions")
    .select("*")
    .order("created_at", { ascending: false });

  return NextResponse.json({ versions: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getServiceClient();
  const body = await req.json();
  const { action, id, name, content, persona, welcome_msg, quick_replies } = body;

  // Activate a specific version
  if (action === "activate" && id) {
    await sb.from("prompt_versions").update({ is_active: false }).neq("id", id);
    const { error } = await sb.from("prompt_versions").update({ is_active: true }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    invalidateBrainCache();
    return NextResponse.json({ success: true });
  }

  // Create new version
  if (!content) return NextResponse.json({ error: "content required" }, { status: 400 });

  const { data, error } = await sb
    .from("prompt_versions")
    .insert({ name: name ?? "version", content, persona, welcome_msg, quick_replies, is_active: false })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, version: data });
}

import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/chatbot/adminAuth";
import { getServiceClient } from "@/lib/supabase/service";

export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getServiceClient();
  const params = req.nextUrl.searchParams;
  const channel = params.get("channel");
  const status  = params.get("status");
  const limit   = Number(params.get("limit") ?? "50");
  const id      = params.get("id");

  // Fetch single conversation with messages
  if (id) {
    const [convRes, msgRes] = await Promise.all([
      sb.from("conversations").select("*").eq("id", id).maybeSingle(),
      sb.from("messages").select("*").eq("conversation_id", id).order("created_at"),
    ]);
    return NextResponse.json({
      conversation: convRes.data,
      messages: msgRes.data ?? [],
    });
  }

  let query = sb
    .from("conversations")
    .select("id, channel, external_user_id, status, summary, started_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (channel) query = query.eq("channel", channel);
  if (status)  query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversations: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status } = await req.json();
  const sb = getServiceClient();

  const { error } = await sb
    .from("conversations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

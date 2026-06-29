import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/chatbot/adminAuth";
import { getServiceClient } from "@/lib/supabase/service";

export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const days = Number(req.nextUrl.searchParams.get("days") ?? "30");
  const sb = getServiceClient();

  try {
    const { data } = await sb.rpc("chatbot_stats", { days_back: days });
    return NextResponse.json(data ?? {});
  } catch {
    // chatbot_stats function may not exist yet — return basic stats
    const cutoff = new Date(Date.now() - days * 86400_000).toISOString();

    const [convRes, msgRes, leadRes] = await Promise.allSettled([
      sb.from("conversations").select("id, channel", { count: "exact" }).gte("started_at", cutoff),
      sb.from("messages").select("tokens_in, tokens_out, model_used", { count: "exact" }).gte("created_at", cutoff),
      sb.from("chatbot_leads").select("id", { count: "exact" }).gte("created_at", cutoff),
    ]);

    const conv = convRes.status === "fulfilled" ? convRes.value : { data: [], count: 0 };
    const msg  = msgRes.status  === "fulfilled" ? msgRes.value  : { data: [], count: 0 };
    const lead = leadRes.status === "fulfilled" ? leadRes.value : { data: [], count: 0 };

    const msgData = (msg.data ?? []) as { tokens_in: number; tokens_out: number }[];
    const tokensIn  = msgData.reduce((s, m) => s + (m.tokens_in  ?? 0), 0);
    const tokensOut = msgData.reduce((s, m) => s + (m.tokens_out ?? 0), 0);

    return NextResponse.json({
      total_conversations: conv.count ?? 0,
      total_messages:      msg.count  ?? 0,
      total_leads:         lead.count ?? 0,
      total_tokens_in:     tokensIn,
      total_tokens_out:    tokensOut,
    });
  }
}

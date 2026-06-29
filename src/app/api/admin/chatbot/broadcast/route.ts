import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/chatbot/adminAuth";
import { getServiceClient } from "@/lib/supabase/service";

async function sendTelegramMessage(chatId: string | number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: "No bot token" };

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });

  return res.json();
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message, channel } = await req.json();
  if (!message?.trim()) return NextResponse.json({ error: "message required" }, { status: 400 });

  if (channel === "telegram") {
    const sb = getServiceClient();

    // Get all unique Telegram users
    const { data: users } = await sb
      .from("unified_users")
      .select("external_id")
      .eq("channel", "telegram");

    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: "No Telegram users found" });
    }

    let sent = 0;
    let failed = 0;

    for (const user of users) {
      try {
        const result = await sendTelegramMessage(user.external_id, message);
        if (result.ok) sent++;
        else failed++;
      } catch {
        failed++;
      }
      // Rate limit: 30 msgs/sec max for Telegram
      await new Promise((r) => setTimeout(r, 35));
    }

    return NextResponse.json({ success: true, sent, failed, total: users.length });
  }

  return NextResponse.json({ error: "Unsupported channel" }, { status: 400 });
}

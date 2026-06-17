import { NextRequest, NextResponse } from "next/server";
import { processMessage } from "@/lib/chatbot/brain";

async function sendTelegramMessage(chatId: number | string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  }).catch(() => undefined);
}

export async function POST(req: NextRequest) {
  const update = await req.json();
  const msg = update.message ?? update.edited_message;

  if (!msg?.chat?.id || !msg?.text) {
    return NextResponse.json({ ok: true });
  }

  const chatId: number = msg.chat.id;
  const text: string = msg.text;
  const sessionId = `telegram_${chatId}`;

  // /start bootstrap — inject a virtual greeting to avoid empty first-turn
  let inputMessage = text;
  if (text === "/start") {
    inputMessage =
      "سلام، به بات BEUR SEASON خوش آمدم. لطفاً خودت را معرفی کن و بگو چطور می‌توانی کمک کنی.";
  } else if (text.startsWith("/")) {
    // Ignore unknown commands
    return NextResponse.json({ ok: true });
  }

  const result = await processMessage({
    message: inputMessage,
    sessionId,
    locale: "fa",
    surface: "telegram",
  });

  await sendTelegramMessage(chatId, result.reply);
  return NextResponse.json({ ok: true });
}

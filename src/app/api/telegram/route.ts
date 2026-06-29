/**
 * Telegram Webhook Handler
 * - /start, /help, /reset commands
 * - Inline quick-reply buttons
 * - Per-user rate limiting (10 msgs/min)
 * - Maps chat_id → unified_users table
 * - Supports broadcast (via admin panel)
 */

import { NextRequest, NextResponse } from "next/server";
import { processMessage } from "@/lib/chatbot/brain";
import { getServiceClient } from "@/lib/supabase/service";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE_URL  = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : "";

// ─── Telegram API helpers ─────────────────────────────────────────────────────

async function tgCall(method: string, body: Record<string, unknown>) {
  if (!BASE_URL) return;
  await fetch(`${BASE_URL}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

async function sendMessage(chatId: number | string, text: string, extra?: Record<string, unknown>) {
  await tgCall("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra });
}

async function sendTyping(chatId: number | string) {
  await tgCall("sendChatAction", { chat_id: chatId, action: "typing" });
}

// ─── Rate limiter (in-memory, 10 messages / 60 seconds per user) ──────────────

const rateMap = new Map<number, { count: number; reset: number }>();
const RATE_LIMIT  = 10;
const RATE_WINDOW = 60_000;

function isRateLimited(chatId: number): boolean {
  const now = Date.now();
  const entry = rateMap.get(chatId);

  if (!entry || now > entry.reset) {
    rateMap.set(chatId, { count: 1, reset: now + RATE_WINDOW });
    return false;
  }

  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

// ─── unified_users sync ───────────────────────────────────────────────────────

async function syncUser(chatId: number, name?: string, username?: string) {
  try {
    const sb = getServiceClient();
    await sb.from("unified_users").upsert(
      {
        channel:     "telegram",
        external_id: String(chatId),
        name:        name      ?? null,
        username:    username  ?? null,
        last_seen:   new Date().toISOString(),
      },
      { onConflict: "channel,external_id" }
    );
  } catch {
    // non-critical
  }
}

// ─── Quick replies keyboard ───────────────────────────────────────────────────

const QUICK_REPLIES = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: "📅 رزرو مشاوره", callback_data: "reserve" },
        { text: "💰 قیمت خدمات",  callback_data: "price" },
      ],
      [
        { text: "🎨 تحلیل رنگ",   callback_data: "color" },
        { text: "📞 ارتباط با ما", callback_data: "contact" },
      ],
    ],
  },
};

const CALLBACK_MESSAGES: Record<string, string> = {
  reserve: "می‌خواهم یک جلسه مشاوره رنگ رزرو کنم. چطور اقدام کنم؟",
  price:   "قیمت خدمات BEUR SEASON چقدر است؟",
  color:   "تحلیل رنگ فصلی چیست و چطور کار می‌کند؟",
  contact: "چطور می‌توانم با تیم BEUR SEASON در ارتباط باشم؟",
};

// ─── Command handlers ─────────────────────────────────────────────────────────

async function handleStart(chatId: number, firstName?: string) {
  const name = firstName ? ` ${firstName}` : "";
  await sendMessage(
    chatId,
    `سلام${name}! 👋\n\nبه ربات <b>BEUR SEASON</b> خوش آمدید 🌸\n\nمن دستیار هوشمند شما برای مشاوره زیبایی داده‌محور هستم.\n\nمی‌توانید:\n• سوال بپرسید\n• وقت مشاوره رزرو کنید\n• درباره خدمات اطلاعات بگیرید`,
    QUICK_REPLIES
  );
}

async function handleHelp(chatId: number) {
  await sendMessage(
    chatId,
    `📖 <b>راهنمای دستورات:</b>\n\n/start — شروع مجدد و معرفی\n/help  — نمایش این راهنما\n/reset — پاک کردن حافظه گفتگو\n\nیا کافی است سوال خود را بنویسید! 😊`,
    QUICK_REPLIES
  );
}

async function handleReset(chatId: number, sessionId: string) {
  try {
    const sb = getServiceClient();
    await sb.from("chat_sessions").delete().eq("session_id", sessionId);
    await sb.from("chat_memory").delete().eq("session_id", sessionId);
  } catch {
    // ignore
  }
  await sendMessage(
    chatId,
    "✅ حافظه گفتگو پاک شد. می‌توانید مکالمه جدیدی شروع کنید.",
    QUICK_REPLIES
  );
}

// ─── Main webhook handler ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let update: Record<string, unknown>;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Handle callback queries (inline button taps)
  const callbackQuery = update.callback_query as {
    id: string;
    from: { id: number; first_name?: string; username?: string };
    message: { chat: { id: number } };
    data: string;
  } | undefined;

  if (callbackQuery) {
    const chatId   = callbackQuery.message.chat.id;
    const userId   = callbackQuery.from.id;
    const data     = callbackQuery.data;

    // Answer the callback to remove loading state
    await tgCall("answerCallbackQuery", { callback_query_id: callbackQuery.id });

    const virtualMessage = CALLBACK_MESSAGES[data];
    if (virtualMessage) {
      const sessionId = `telegram_${userId}`;
      await sendTyping(chatId);
      const result = await processMessage({ message: virtualMessage, sessionId, locale: "fa", surface: "telegram" });
      await sendMessage(chatId, result.reply);
    }

    return NextResponse.json({ ok: true });
  }

  // Handle regular messages
  const msg = (update.message ?? update.edited_message) as {
    chat: { id: number };
    from?: { id: number; first_name?: string; last_name?: string; username?: string };
    text?: string;
  } | undefined;

  if (!msg?.chat?.id) return NextResponse.json({ ok: true });

  const chatId    = msg.chat.id;
  const text      = msg.text;
  const from      = msg.from;
  const sessionId = `telegram_${chatId}`;

  if (!text) return NextResponse.json({ ok: true });

  // Sync user to unified_users
  const fullName = [from?.first_name, from?.last_name].filter(Boolean).join(" ");
  syncUser(chatId, fullName || undefined, from?.username).catch(() => undefined);

  // Commands
  if (text === "/start") {
    await handleStart(chatId, from?.first_name);
    return NextResponse.json({ ok: true });
  }

  if (text === "/help") {
    await handleHelp(chatId);
    return NextResponse.json({ ok: true });
  }

  if (text === "/reset") {
    await handleReset(chatId, sessionId);
    return NextResponse.json({ ok: true });
  }

  // Ignore other unknown commands
  if (text.startsWith("/")) {
    await sendMessage(chatId, "دستور ناشناخته. برای راهنما /help را ارسال کنید.");
    return NextResponse.json({ ok: true });
  }

  // Rate limit check
  if (isRateLimited(chatId)) {
    await sendMessage(
      chatId,
      "⚠️ تعداد پیام‌های شما به حد مجاز رسیده. لطفاً یک دقیقه صبر کنید."
    );
    return NextResponse.json({ ok: true });
  }

  // Process message with brain
  await sendTyping(chatId);

  try {
    const result = await processMessage({
      message: text,
      sessionId,
      locale: "fa",
      surface: "telegram",
    });

    await sendMessage(chatId, result.reply, QUICK_REPLIES);
  } catch (err) {
    console.error("[telegram] processMessage error:", err);
    await sendMessage(chatId, "متأسفم، مشکلی پیش آمد. لطفاً دوباره تلاش کنید.");
  }

  return NextResponse.json({ ok: true });
}

// GET for webhook verification
export async function GET() {
  return NextResponse.json({ ok: true, service: "BEUR SEASON Telegram Bot" });
}

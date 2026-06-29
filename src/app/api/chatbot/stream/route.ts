import { NextRequest } from "next/server";
import { streamMessage } from "@/lib/chatbot/brain";
import { randomUUID } from "crypto";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId, locale, surface } = await req.json();

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: "پیام خالی است" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const sid = sessionId || randomUUID();
    const stream = await streamMessage({
      message: message.trim(),
      sessionId: sid,
      locale: locale ?? "fa",
      surface: surface ?? "web",
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Session-Id": sid,
        ...CORS,
      },
    });
  } catch (err) {
    console.error("[stream API]", err);
    return new Response(JSON.stringify({ error: "خطای سرور" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
}

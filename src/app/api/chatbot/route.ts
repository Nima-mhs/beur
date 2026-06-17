import { NextRequest, NextResponse } from "next/server";
import { processMessage } from "@/lib/chatbot/brain";
import { randomUUID } from "crypto";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Preflight for cross-origin widget requests
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId, locale } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json(
        { error: "پیام نمی‌تواند خالی باشد" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const sid = sessionId || randomUUID();
    const result = await processMessage({
      message: message.trim(),
      sessionId: sid,
      locale: locale ?? "fa",
      surface: "web",
    });

    return NextResponse.json(
      { reply: result.reply, sessionId: sid },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("Chatbot API error:", err);
    return NextResponse.json(
      { error: "خطای سرور" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

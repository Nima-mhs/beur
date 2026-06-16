import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const OPENROUTER_CHAT_MODEL = "google/gemma-4-31b-it:free";

const SYSTEM_PROMPT = `You are BEUR SEASON's expert AI color consultant. You specialize in:
- 4-season personal color analysis (Spring, Summer, Autumn, Winter)
- Skin undertone identification (Warm, Cool, Neutral)
- Hair color recommendations based on color season
- Eyebrow shaping and color advice
- Makeup color recommendations: foundation undertone, blush, lipstick, eyeshadow
- Color theory and how it applies to personal style

Respond in the same language the user writes in:
- Persian/Farsi → respond fully in Persian
- English → respond fully in English

Be warm, professional, and educational. Keep answers concise (2-4 paragraphs max).
When relevant, mention that users can upload a photo on the color analysis page for a personalized AI analysis.`;

async function chatWithClaude(messages: { role: string; content: string }[]) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: messages as { role: "user" | "assistant"; content: string }[],
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
}

async function chatWithOpenRouter(messages: { role: string; content: string }[]) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://beurseason.com",
      "X-Title": "BEUR SEASON Chatbot",
    },
    body: JSON.stringify({
      model: OPENROUTER_CHAT_MODEL,
      max_tokens: 1024,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages,
      ],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `OpenRouter ${res.status}`);
  return data.choices?.[0]?.message?.content ?? "";
}

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    const hasClaudeKey =
      process.env.ANTHROPIC_API_KEY &&
      !process.env.ANTHROPIC_API_KEY.includes("your_");
    const hasOpenRouterKey =
      process.env.OPENROUTER_API_KEY &&
      !process.env.OPENROUTER_API_KEY.includes("your_");

    // 1. Try Claude Haiku first
    if (hasClaudeKey) {
      try {
        const text = await chatWithClaude(messages);
        return NextResponse.json({ message: text });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        const isCreditError =
          msg.includes("credit balance") ||
          msg.includes("insufficient") ||
          msg.includes("billing") ||
          msg.includes("402");
        if (!isCreditError) {
          console.error("Claude chat error:", msg);
        }
      }
    }

    // 2. Try OpenRouter
    if (hasOpenRouterKey) {
      try {
        const text = await chatWithOpenRouter(messages);
        return NextResponse.json({ message: text });
      } catch (e: unknown) {
        console.error("OpenRouter chat error:", e);
      }
    }

    // 3. Fallback message
    const lastMsg: string = messages[messages.length - 1]?.content ?? "";
    const isFa = /[؀-ۿ]/.test(lastMsg);
    return NextResponse.json({
      message: isFa
        ? "در حال حاضر سرویس چت در دسترس نیست. می‌توانید از صفحه آنالیز رنگ برای آپلود عکس و دریافت مشاوره استفاده کنید."
        : "Chat is currently unavailable. Please use the Color Analysis page to upload your photo and get personalized results.",
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json({ error: "Chat temporarily unavailable" }, { status: 500 });
  }
}

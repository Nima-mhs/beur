import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return NextResponse.json({ error: "OPENROUTER_API_KEY not set" });

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-4.5",
        max_tokens: 10,
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    const data = await res.json();
    return NextResponse.json({
      status: res.status,
      ok: res.ok,
      reply: data.choices?.[0]?.message?.content,
      error: data.error,
      keyPrefix: key.slice(0, 12) + "...",
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) });
  }
}

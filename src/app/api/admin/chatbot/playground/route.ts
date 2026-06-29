import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/chatbot/adminAuth";
import { searchKnowledge } from "@/lib/chatbot/rag";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { query, topK, threshold, modelA, modelB } = await req.json();

  if (!query?.trim()) return NextResponse.json({ error: "query required" }, { status: 400 });

  // Retrieve relevant chunks
  const ragResult = await searchKnowledge(query, topK, threshold);

  // If comparing two models, call both via OpenRouter
  const key = process.env.OPENROUTER_API_KEY;
  const results: Record<string, unknown> = {
    chunks: ragResult.chunks,
    context: ragResult.context,
  };

  if (!key || (!modelA && !modelB)) {
    return NextResponse.json(results);
  }

  const systemPrompt = `پاسخ دقیق و مختصر بده. Context:\n${ragResult.context}`;

  async function callModel(model: string) {
    const start = Date.now();
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://beurseason.com",
          "X-Title": "BEUR SEASON Playground",
        },
        body: JSON.stringify({
          model,
          max_tokens: 512,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: query },
          ],
        }),
      });
      const data = await res.json();
      return {
        model,
        response: data.choices?.[0]?.message?.content ?? "",
        tokens_in:  data.usage?.prompt_tokens ?? 0,
        tokens_out: data.usage?.completion_tokens ?? 0,
        latency_ms: Date.now() - start,
        error: null,
      };
    } catch (err) {
      return { model, response: "", tokens_in: 0, tokens_out: 0, latency_ms: Date.now() - start, error: String(err) };
    }
  }

  const promises = [];
  if (modelA) promises.push(callModel(modelA));
  if (modelB) promises.push(callModel(modelB));

  const [resA, resB] = await Promise.all(promises);
  if (resA) results.modelA = resA;
  if (resB) results.modelB = resB;

  return NextResponse.json(results);
}

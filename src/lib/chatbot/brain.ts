import Anthropic from "@anthropic-ai/sdk";
import { searchKnowledge } from "./rag";
import { loadSession, saveSession, saveLongTermMemory, type ChatMessage } from "./memory";
import { TOOLS, executeTool } from "./tools";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function isCreditError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    msg.includes("credit balance") ||
    msg.includes("insufficient") ||
    msg.includes("billing") ||
    msg.includes("402")
  );
}

const FREE_MODELS = [
  "google/gemma-2-9b-it:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "microsoft/phi-3-mini-128k-instruct:free",
];

async function chatWithOpenRouter(
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("No OpenRouter key");

  for (const model of FREE_MODELS) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://beur-yd3c.vercel.app",
          "X-Title": "BEUR SEASON Chatbot",
        },
        body: JSON.stringify({
          model,
          max_tokens: 800,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error(`OpenRouter ${model} failed:`, data.error?.message);
        continue;
      }
      const text = data.choices?.[0]?.message?.content ?? "";
      if (text) return text;
    } catch (err) {
      console.error(`OpenRouter ${model} error:`, err);
    }
  }
  throw new Error("All OpenRouter models failed");
}

const SYSTEM_PROMPT = `تو یک دستیار هوشمند فارسی‌زبان برای مجموعه BEUR SEASON هستی — اولین سرویس مشاوره زیبایی داده‌محور فارسی‌زبان.

وظایف اصلی:
- پاسخ به سوالات درباره خدمات، رزرو، قیمت و تحلیل رنگ
- کمک به رزرو مشاوره (با گرفتن نام و تماس)
- مشاوره در زمینه Color Season، زیرتُن پوست و انتخاب رنگ
- گرفتن لید از کاربران علاقه‌مند (ابزار capture_lead)
- بررسی وضعیت رزرو (ابزار check_enrollment_status)

قوانین:
- همیشه به فارسی پاسخ بده مگر کاربر به انگلیسی بنویسد
- صمیمی، گرم و حرفه‌ای باش
- پاسخ‌ها را کوتاه و مفید نگه دار (۲-۳ پاراگراف)
- هرگز اطلاعات نادرست یا ساختگی نده
- وقتی کاربر می‌خواهد رزرو کند، نام و شماره‌اش را بپرس سپس capture_lead فراخوانی کن

اطلاعات از پایگاه دانش:
{RAG_CONTEXT}

حافظه این کاربر از مکالمات قبلی:
{LONG_TERM_MEMORY}`;

export interface BrainInput {
  message: string;
  sessionId: string;
  locale?: string;
  surface?: "web" | "telegram" | "widget";
}

export interface BrainOutput {
  reply: string;
  sessionId: string;
}

export async function processMessage(input: BrainInput): Promise<BrainOutput> {
  const { message, sessionId, locale = "fa" } = input;

  const [ragContext, { messages: history, longTermMemory }] = await Promise.all([
    searchKnowledge(message),
    loadSession(sessionId),
  ]);

  const systemPrompt = SYSTEM_PROMPT
    .replace("{RAG_CONTEXT}", ragContext || "اطلاعاتی در پایگاه دانش یافت نشد.")
    .replace("{LONG_TERM_MEMORY}", longTermMemory || "اطلاعات ذخیره‌شده‌ای وجود ندارد.");

  const userMessage: ChatMessage = { role: "user", content: message };
  const allMessages: ChatMessage[] = [...history, userMessage];

  let reply = "";

  // ── 1. Try Claude (with tool use) ──────────────────────────────────────
  let claudeFailed = false;
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: allMessages,
      tools: TOOLS,
    });

    if (response.stop_reason === "tool_use") {
      const toolBlock = response.content.find((b) => b.type === "tool_use");

      if (toolBlock?.type === "tool_use") {
        const toolResult = await executeTool(
          toolBlock.name,
          toolBlock.input as Record<string, string>,
          sessionId
        );

        if (toolBlock.name === "capture_lead") {
          const inp = toolBlock.input as Record<string, string>;
          await Promise.all(
            [
              inp.name  && saveLongTermMemory(sessionId, "name",  inp.name),
              inp.phone && saveLongTermMemory(sessionId, "phone", inp.phone),
              inp.email && saveLongTermMemory(sessionId, "email", inp.email),
            ].filter(Boolean) as Promise<void>[]
          );
        }

        const followUp = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            ...allMessages,
            { role: "assistant" as const, content: response.content },
            {
              role: "user" as const,
              content: [{ type: "tool_result" as const, tool_use_id: toolBlock.id, content: toolResult }],
            },
          ],
          tools: TOOLS,
        });

        reply = followUp.content
          .filter((b) => b.type === "text")
          .map((b) => (b.type === "text" ? b.text : ""))
          .join("");
      }
    } else {
      reply = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("");
    }
  } catch (err) {
    if (isCreditError(err)) {
      claudeFailed = true;
    } else {
      console.error("Brain/Claude error:", err);
      claudeFailed = true;
    }
  }

  // ── 2. Fallback: OpenRouter (no tool use) ───────────────────────────────
  if (claudeFailed && process.env.OPENROUTER_API_KEY) {
    try {
      reply = await chatWithOpenRouter(systemPrompt, allMessages);
    } catch (err) {
      console.error("Brain/OpenRouter error:", err);
    }
  }

  if (!reply) {
    reply =
      locale === "fa"
        ? "در حال حاضر در دسترس نیستم. لطفاً کمی بعد دوباره امتحان کنید."
        : "Currently unavailable. Please try again later.";
  }

  const assistantMessage: ChatMessage = { role: "assistant", content: reply };
  await saveSession(sessionId, [...allMessages, assistantMessage]);

  return { reply, sessionId };
}

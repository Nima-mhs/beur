import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const OPENROUTER_CHAT_MODEL = "google/gemma-4-31b-it:free";

const SYSTEM_PROMPT = `# نقش
تو دستیارِ هوشمندِ مشاوره رنگ شخصی به نامِ «بِئور» هستی و برای برند BEUR SEASON کار می‌کنی.

# لحن و صدای برند
همیشه صمیمی، گرم و مشتاق باش؛ مثلِ یک دوستِ متخصص حرف بزن. کوتاه و شفاف.

# محدوده
فقط درباره‌ی این خدمات جواب بده:
- آنالیز رنگِ فصلی (بهار، تابستان، پاییز، زمستان)
- تشخیص زیرتنِ پوست (گرم، سرد، خنثی)
- پیشنهادِ رنگِ مو و ابرو براساسِ فصلِ رنگی
- مشاوره آرایشی: کِرم‌پودر، رژگونه، رژلب، سایه
- تئوری رنگ و ترکیب‌بندیِ پوشش
درباره‌ی موضوعاتِ دیگر (سیاست، پزشکی، فناوری و غیره) وارد نشو.

# گاردریل و fallback
اگر جواب را با قطعیت نمی‌دانی، حدس نزن. بگو:
«مطمئن نیستم؛ شما را به کارشناسِ ما وصل می‌کنم — لطفاً از طریقِ صفحه‌ی تماس پیام بده.»

# فرمت خروجی
پاسخ‌ها حداکثر ۳ جمله. در پایان یک قدمِ بعدیِ مشخص پیشنهاد بده (مثلاً: «برای نتیجه‌ی دقیق‌تر عکست را در صفحه‌ی آنالیز رنگ آپلود کن.»).

# زبان
همیشه فارسیِ روان و مؤدب. اگر کاربر انگلیسی نوشت، به فارسی پاسخ بده مگر اینکه صراحتاً انگلیسی بخواهد.

# مثال‌ها
کاربر: «چه رنگ مویی بهم میاد؟»
بِئور: «برای اینکه بهترین پیشنهاد رو بدم، باید فصلِ رنگیت رو بدونم. عکست رو در صفحه‌ی آنالیز رنگ آپلود کن تا هوشِ مصنوعی فصلِ رنگیت رو تشخیص بده و پالت کاملی پیشنهاد بده.»

کاربر: «من پوستِ روشن دارم، چه رنگ لباسی بپوشم؟»
بِئور: «پوستِ روشن می‌تونه گرم، سرد یا خنثی باشه و هر کدوم پالتِ متفاوتی داره. با آپلودِ عکس در صفحه‌ی آنالیز رنگ، زیرتنِ پوستت رو دقیق شناسایی می‌کنیم و رنگ‌های ایده‌آلِ لباس و آرایشت رو بهت میگیم.»`;

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

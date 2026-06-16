import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// Static fallback list — prefer gemma-4-31b per user preference
const STATIC_VISION_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemini-2.0-flash-exp:free",
  "meta-llama/llama-4-scout:free",
  "qwen/qwen2.5-vl-72b-instruct:free",
  "google/gemini-flash-1.5:free",
  "google/gemma-4-26b-a4b-it:free",
  "nex-agi/nex-n2-pro:free",
];

// Module-level cache: refreshed every 10 min
let _cachedModels: string[] = [];
let _cacheTs = 0;

async function getVisionModels(): Promise<string[]> {
  if (_cachedModels.length > 0 && Date.now() - _cacheTs < 10 * 60 * 1000) {
    return _cachedModels;
  }
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return STATIC_VISION_MODELS;
    const data = await res.json();
    type ModelEntry = { id: string; pricing?: { prompt?: string; completion?: string }; architecture?: { modalities?: string } };
    const free: string[] = (data.data as ModelEntry[] ?? [])
      .filter(m =>
        m.pricing?.prompt === "0" &&
        m.pricing?.completion === "0" &&
        (m.architecture?.modalities?.includes("image") ||
          /vision|vl-|gemini|gemma-4/.test(m.id))
      )
      .map(m => m.id);
    if (free.length === 0) return STATIC_VISION_MODELS;
    // Bring gemma-4-31b to front if present (user preference)
    const preferred = free.filter(m => m.includes("gemma-4-31b"));
    const rest = free.filter(m => !m.includes("gemma-4-31b"));
    _cachedModels = [...preferred, ...rest].slice(0, 8);
    _cacheTs = Date.now();
    console.log("Free vision models found:", _cachedModels);
    return _cachedModels;
  } catch {
    return STATIC_VISION_MODELS;
  }
}

const ANALYSIS_PROMPT = `You are a certified professional color analyst specializing in the 4-season personal color analysis system.
Analyze the uploaded face photo and determine:
1. Skin undertone (Warm/Cool/Neutral)
2. Color season (Spring/Summer/Autumn/Winter)
3. Recommended hair colors (3-5 options)
4. Recommended eyebrow colors (2-3 options)
5. Makeup recommendations: foundation undertone, blush (2-3), lipstick (3-5), eyeshadow (3-5)
6. Colors to avoid (3-4)

Return ONLY a JSON object with this exact structure — no markdown, no explanation:
{
  "season": "Spring",
  "seasonFa": "بهار",
  "undertone": "Warm",
  "undertoneFa": "گرم",
  "undertoneDescription": "Your skin has warm golden-peachy undertones...",
  "undertoneDescriptionFa": "پوست شما زیرتُن گرم طلایی-هلویی دارد...",
  "skinTone": "Light warm beige",
  "skinToneFa": "بژ گرم روشن",
  "seasonDescription": "As a Spring type, you radiate warmth and freshness...",
  "seasonDescriptionFa": "به‌عنوان تیپ بهاری، گرما و شادابی را منعکس می‌کنی...",
  "hairColors": [
    { "name": "Golden Blonde", "nameFa": "بلوند طلایی", "hex": "#C8A95A" },
    { "name": "Honey Brown", "nameFa": "قهوه‌ای عسلی", "hex": "#8B6332" },
    { "name": "Warm Auburn", "nameFa": "قرمز گرم", "hex": "#9B4423" }
  ],
  "eyebrowColors": [
    { "name": "Warm Brown", "nameFa": "قهوه‌ای گرم", "hex": "#7A4E2D" },
    { "name": "Soft Taupe", "nameFa": "خاکی نرم", "hex": "#9C8B78" }
  ],
  "makeup": {
    "foundationUndertone": "Warm/Yellow",
    "foundationUndertoneFa": "گرم/زرد",
    "blush": [
      { "name": "Peach", "nameFa": "هلویی", "hex": "#E8A87C" },
      { "name": "Coral", "nameFa": "مرجانی", "hex": "#E8735A" }
    ],
    "lipstick": [
      { "name": "Warm Coral", "nameFa": "مرجانی گرم", "hex": "#E05540" },
      { "name": "Salmon", "nameFa": "سالمون", "hex": "#FF8C7A" },
      { "name": "Warm Red", "nameFa": "قرمز گرم", "hex": "#CC3300" }
    ],
    "eyeshadow": [
      { "name": "Champagne", "nameFa": "شامپاین", "hex": "#F0D9B5" },
      { "name": "Peach", "nameFa": "هلویی", "hex": "#EAA672" },
      { "name": "Bronze", "nameFa": "برنز", "hex": "#8B6332" }
    ]
  },
  "avoidColors": [
    { "name": "Ash Blonde", "nameFa": "بلوند خاکستری", "hex": "#B8A9A9" },
    { "name": "Deep Burgundy", "nameFa": "بوردو تیره", "hex": "#4A0E2A" },
    { "name": "Stark White", "nameFa": "سفید خالص", "hex": "#F5F5F5" }
  ]
}`;

const MOCK_RESULT = {
  season: "Autumn",
  seasonFa: "پاییز",
  undertone: "Warm",
  undertoneFa: "گرم",
  undertoneDescription: "Your skin has warm, golden-earthy undertones with rich depth.",
  undertoneDescriptionFa: "پوست شما زیرتُن گرم و طلایی-خاکی با عمق غنی دارد.",
  skinTone: "Medium warm olive",
  skinToneFa: "زیتونی گرم متوسط",
  seasonDescription: "As an Autumn type, your coloring is rich, warm and earthy. You radiate depth and warmth.",
  seasonDescriptionFa: "به‌عنوان تیپ پاییزی، رنگ‌بندی تو غنی، گرم و زمینی است. عمق و گرما را منعکس می‌کنی.",
  hairColors: [
    { name: "Auburn", nameFa: "قرمز پاییزی", hex: "#7B2C02" },
    { name: "Chestnut", nameFa: "شاه‌بلوطی", hex: "#8B4513" },
    { name: "Copper Red", nameFa: "قرمز مسی", hex: "#9B4423" },
    { name: "Dark Golden Brown", nameFa: "قهوه‌ای طلایی تیره", hex: "#5C3317" },
  ],
  eyebrowColors: [
    { name: "Dark Warm Brown", nameFa: "قهوه‌ای گرم تیره", hex: "#4A2C17" },
    { name: "Chocolate", nameFa: "شکلاتی", hex: "#5C3317" },
    { name: "Warm Brown", nameFa: "قهوه‌ای گرم", hex: "#7A4429" },
  ],
  makeup: {
    foundationUndertone: "Warm/Golden",
    foundationUndertoneFa: "گرم/طلایی",
    blush: [
      { name: "Terracotta", nameFa: "تراکوتا", hex: "#C4522A" },
      { name: "Brick Rose", nameFa: "رُز آجری", hex: "#B85C3A" },
    ],
    lipstick: [
      { name: "Terracotta", nameFa: "تراکوتا", hex: "#CC5533" },
      { name: "Brick Red", nameFa: "قرمز آجری", hex: "#BB4420" },
      { name: "Warm Brown", nameFa: "قهوه‌ای گرم", hex: "#8B4513" },
      { name: "Deep Coral", nameFa: "مرجانی تیره", hex: "#C44A2A" },
    ],
    eyeshadow: [
      { name: "Copper", nameFa: "مسی", hex: "#B87333" },
      { name: "Olive", nameFa: "زیتونی", hex: "#6B7C3B" },
      { name: "Bronze", nameFa: "برنز", hex: "#8B6332" },
      { name: "Warm Taupe", nameFa: "خاکی گرم", hex: "#8B7355" },
    ],
  },
  avoidColors: [
    { name: "Baby Pink", nameFa: "صورتی ملایم", hex: "#FFB6C1" },
    { name: "Baby Blue", nameFa: "آبی روشن", hex: "#87CEEB" },
    { name: "Silver", nameFa: "نقره‌ای", hex: "#C0C0C0" },
    { name: "Black & White only", nameFa: "فقط سیاه و سفید", hex: "#808080" },
  ],
};

async function analyzeWithClaude(imageBase64: string, mimeType: string) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3500,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
              data: imageBase64,
            },
          },
          { type: "text", text: ANALYSIS_PROMPT },
        ],
      },
    ],
  });
  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("No JSON in Claude response");
  return JSON.parse(m[0]);
}

async function analyzeWithOpenRouter(imageBase64: string, mimeType: string) {
  const models = await getVisionModels();
  for (const model of models) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://beurseason.com",
          "X-Title": "BEUR SEASON Color Analysis",
        },
        body: JSON.stringify({
          model,
          max_tokens: 3500,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: `data:${mimeType};base64,${imageBase64}` },
                },
                { type: "text", text: ANALYSIS_PROMPT },
              ],
            },
          ],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const errMsg: string = data.error?.message ?? `${res.status}`;
        // Skip immediately if model is not free
        if (errMsg.includes("unavailable for free") || errMsg.includes("not free")) {
          console.log(`Model not free, skipping: ${model}`);
          // Invalidate cache so next request re-fetches
          _cacheTs = 0;
          continue;
        }
        // Retry once on overload
        if (errMsg.includes("Provider returned error") || errMsg.includes("overload") || res.status === 503) {
          console.log(`Retrying ${model} after 3s...`);
          await new Promise((r) => setTimeout(r, 3000));
          const res2 = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://beurseason.com",
              "X-Title": "BEUR SEASON Color Analysis",
            },
            body: JSON.stringify({
              model,
              max_tokens: 3500,
              messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } }, { type: "text", text: ANALYSIS_PROMPT }] }],
            }),
          });
          if (res2.ok) {
            const data2 = await res2.json();
            const text2: string = data2.choices?.[0]?.message?.content ?? "";
            const parsed2 = tryParseJson(text2);
            if (parsed2) { console.log(`Retry success: ${model}`); return parsed2; }
          }
        }
        console.log(`OpenRouter model ${model} failed: ${errMsg}`);
        continue;
      }

      const text: string = data.choices?.[0]?.message?.content ?? "";
      const parsed = tryParseJson(text);
      if (!parsed) { console.log(`No valid JSON from ${model}`); continue; }

      console.log(`OpenRouter success with model: ${model}`);
      return parsed;
    } catch (e) {
      console.log(`OpenRouter model ${model} threw: ${e}`);
    }
  }
  throw new Error("All OpenRouter models failed");
}

function tryParseJson(text: string): object | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;

  // Direct parse
  try { return JSON.parse(m[0]); } catch { /* fall through */ }

  // Repair truncated JSON: close open arrays/objects
  let json = m[0];
  // Strip any incomplete last line
  const lastComplete = Math.max(json.lastIndexOf("},"), json.lastIndexOf("}]"), json.lastIndexOf('"}'));
  if (lastComplete > json.length * 0.5) json = json.substring(0, lastComplete + 2);

  let braces = 0, brackets = 0;
  let inStr = false, escape = false;
  for (const ch of json) {
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inStr) { escape = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === "{") braces++;
    else if (ch === "}") braces--;
    else if (ch === "[") brackets++;
    else if (ch === "]") brackets--;
  }
  json += "]".repeat(Math.max(0, brackets)) + "}".repeat(Math.max(0, braces));

  try { return JSON.parse(json); } catch { return null; }
}

function isCreditError(msg: string) {
  return (
    msg.includes("credit balance") ||
    msg.includes("insufficient") ||
    msg.includes("billing") ||
    msg.includes("402")
  );
}

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, mimeType } = await request.json();
    if (!imageBase64) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const hasClaudeKey =
      process.env.ANTHROPIC_API_KEY &&
      !process.env.ANTHROPIC_API_KEY.includes("your_");
    const hasOpenRouterKey =
      process.env.OPENROUTER_API_KEY &&
      !process.env.OPENROUTER_API_KEY.includes("your_");

    // 1. Try Claude first
    if (hasClaudeKey) {
      try {
        const analysis = await analyzeWithClaude(imageBase64, mimeType || "image/jpeg");
        return NextResponse.json({ analysis, provider: "claude" });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("Claude failed:", msg);
        if (!isCreditError(msg)) {
          return NextResponse.json({ error: "Analysis failed." }, { status: 500 });
        }
        console.log("Claude credits low — trying OpenRouter...");
      }
    }

    // 2. Try OpenRouter (Gemma free)
    if (hasOpenRouterKey) {
      try {
        const analysis = await analyzeWithOpenRouter(imageBase64, mimeType || "image/jpeg");
        return NextResponse.json({ analysis, provider: "openrouter" });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("OpenRouter failed:", msg);
      }
    }

    // 3. Demo fallback
    await new Promise((r) => setTimeout(r, 1200));
    return NextResponse.json({ analysis: MOCK_RESULT, provider: "demo" });
  } catch (error) {
    console.error("analyze-colors error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

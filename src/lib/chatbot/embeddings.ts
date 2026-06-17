import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI: GoogleGenerativeAI | null = null;

function getClient() {
  if (!genAI && process.env.GOOGLE_AI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  }
  return genAI;
}

// Returns 768-dim embedding (text-embedding-004), or null when key is absent.
export async function embedText(text: string): Promise<number[] | null> {
  const ai = getClient();
  if (!ai) return null;
  try {
    const model = ai.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch {
    return null;
  }
}

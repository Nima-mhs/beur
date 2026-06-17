import { getServiceClient } from "@/lib/supabase/service";
import { embedText } from "./embeddings";

export async function searchKnowledge(query: string, matchCount = 5): Promise<string> {
  if (!query.trim()) return "";

  const supabase = getServiceClient();
  let docs: { content: string }[] = [];

  // 1. Vector search (requires GOOGLE_AI_API_KEY)
  const embedding = await embedText(query);
  if (embedding) {
    const { data } = await supabase.rpc("match_documents", {
      query_embedding: embedding,
      match_count: matchCount,
      similarity_threshold: 0.55,
    });
    docs = data ?? [];
  }

  // 2. Fallback: return all docs (knowledge base is small, AI will filter)
  if (!docs.length) {
    const { data } = await supabase
      .from("chatbot_documents")
      .select("content")
      .limit(matchCount);
    docs = data ?? [];
  }

  return docs.map((d) => d.content).join("\n\n---\n\n");
}

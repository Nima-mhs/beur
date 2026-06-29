/**
 * RAG retrieval: embed query → vector search → return context string + citations.
 * Uses the new chunks table (via match_chunks RPC) with fallback to chatbot_documents.
 */

import { getServiceClient } from "@/lib/supabase/service";
import { embedQuery, getEmbeddingConfig } from "./embeddings";

export interface RetrievedChunk {
  id: string;
  document_id: string;
  content: string;
  similarity: number;
  doc_title: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeResult {
  context: string;       // formatted context to inject into system prompt
  chunks: RetrievedChunk[];
  chunk_ids: string[];
}

export async function searchKnowledge(
  query: string,
  overrideTopK?: number,
  overrideThreshold?: number
): Promise<KnowledgeResult> {
  const empty: KnowledgeResult = { context: "", chunks: [], chunk_ids: [] };
  if (!query.trim()) return empty;

  const sb = getServiceClient();
  const cfg = await getEmbeddingConfig();
  const top_k = overrideTopK ?? cfg.top_k;
  const threshold = overrideThreshold ?? cfg.similarity_threshold;

  // 1. Embed the query
  const queryEmbedding = await embedQuery(query);

  if (queryEmbedding) {
    // 2a. Vector search on new chunks table
    try {
      const { data, error } = await sb.rpc("match_chunks", {
        query_embedding: `[${queryEmbedding.join(",")}]`,
        match_count: top_k,
        sim_threshold: threshold,
      });

      if (!error && data && data.length > 0) {
        const chunks: RetrievedChunk[] = data.map(
          (d: {
            id: string;
            document_id: string;
            content: string;
            similarity: number;
            doc_title: string;
            metadata?: Record<string, unknown>;
          }) => ({
            id: d.id,
            document_id: d.document_id,
            content: d.content,
            similarity: d.similarity,
            doc_title: d.doc_title,
            metadata: d.metadata,
          })
        );
        return buildResult(chunks);
      }
    } catch {
      // chunks table may not exist yet — fall through
    }

    // 2b. Fallback: vector search on legacy chatbot_documents
    try {
      const { data: legacyData } = await sb.rpc("match_documents", {
        query_embedding: `[${queryEmbedding.join(",")}]`,
        match_count: top_k,
        similarity_threshold: threshold,
      });

      if (legacyData && legacyData.length > 0) {
        const chunks: RetrievedChunk[] = legacyData.map(
          (d: { id: string; content: string; similarity: number; metadata?: Record<string, unknown> }) => ({
            id: d.id,
            document_id: d.id,
            content: d.content,
            similarity: d.similarity,
            doc_title: "پایگاه دانش",
            metadata: d.metadata,
          })
        );
        return buildResult(chunks);
      }
    } catch {
      // ignore
    }
  }

  // 3. Full-scan fallback (no embedding available)
  try {
    const { data: allDocs } = await sb
      .from("chatbot_documents")
      .select("id, content, metadata")
      .limit(top_k);

    if (allDocs && allDocs.length > 0) {
      const chunks: RetrievedChunk[] = allDocs.map(
        (d: { id: string; content: string; metadata?: Record<string, unknown> }) => ({
          id: d.id,
          document_id: d.id,
          content: d.content,
          similarity: 0,
          doc_title: "پایگاه دانش",
          metadata: d.metadata,
        })
      );
      return buildResult(chunks);
    }
  } catch {
    // ignore
  }

  return empty;
}

function buildResult(chunks: RetrievedChunk[]): KnowledgeResult {
  const context = chunks
    .map((c, i) => `[منبع ${i + 1}: ${c.doc_title}]\n${c.content}`)
    .join("\n\n---\n\n");

  return {
    context,
    chunks,
    chunk_ids: chunks.map((c) => c.id),
  };
}

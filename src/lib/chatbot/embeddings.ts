/**
 * Multi-provider embedding service.
 * Reads active config from embedding_config table; falls back to env defaults.
 * Supported providers: cohere | openai | google | voyage
 */

import { getServiceClient } from "@/lib/supabase/service";

export type EmbeddingProvider = "cohere" | "openai" | "google" | "voyage";

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model: string;
  dimensions: number;
  chunk_size: number;
  chunk_overlap: number;
  top_k: number;
  similarity_threshold: number;
  reranker_enabled: boolean;
  reranker_model: string | null;
  input_type_doc: string;
  input_type_query: string;
}

const DEFAULT_CONFIG: EmbeddingConfig = {
  provider: "cohere",
  model: "embed-multilingual-v3.0",
  dimensions: 1024,
  chunk_size: 500,
  chunk_overlap: 50,
  top_k: 5,
  similarity_threshold: 0.5,
  reranker_enabled: false,
  reranker_model: null,
  input_type_doc: "search_document",
  input_type_query: "search_query",
};

let _configCache: EmbeddingConfig | null = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute

export async function getEmbeddingConfig(): Promise<EmbeddingConfig> {
  if (_configCache && Date.now() - _cacheTime < CACHE_TTL) return _configCache;

  try {
    const sb = getServiceClient();
    const { data } = await sb
      .from("embedding_config")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      const merged: EmbeddingConfig = { ...DEFAULT_CONFIG, ...(data as Partial<EmbeddingConfig>) };
      _configCache = merged;
      _cacheTime = Date.now();
      return _configCache;
    }
  } catch {
    // DB not ready yet — use defaults
  }

  return DEFAULT_CONFIG;
}

// Invalidate cache when config is updated from admin panel
export function invalidateEmbeddingCache() {
  _configCache = null;
  _cacheTime = 0;
}

// ─── Provider implementations ────────────────────────────────────────────────

async function embedCohere(
  texts: string[],
  model: string,
  inputType: string
): Promise<number[][]> {
  const key = process.env.COHERE_API_KEY;
  if (!key) throw new Error("COHERE_API_KEY not set");

  const res = await fetch("https://api.cohere.com/v1/embed", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ texts, model, input_type: inputType }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cohere embed error: ${err}`);
  }

  const data = await res.json();
  return data.embeddings as number[][];
}

async function embedOpenAI(
  texts: string[],
  model: string
): Promise<number[][]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: texts, model }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embed error: ${err}`);
  }

  const data = await res.json();
  return (data.data as { embedding: number[] }[]).map((d) => d.embedding);
}

async function embedGoogle(
  texts: string[],
  model: string
): Promise<number[][]> {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) throw new Error("GOOGLE_AI_API_KEY not set");

  // Google Generative AI batch embedding
  const embeddings: number[][] = [];
  for (const text of texts) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: `models/${model}`,
          content: { parts: [{ text }] },
        }),
      }
    );

    if (!res.ok) throw new Error(`Google embed error: ${await res.text()}`);
    const data = await res.json();
    embeddings.push(data.embedding.values);
  }
  return embeddings;
}

async function embedVoyage(
  texts: string[],
  model: string,
  inputType: string
): Promise<number[][]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error("VOYAGE_API_KEY not set");

  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: texts, model, input_type: inputType }),
  });

  if (!res.ok) throw new Error(`Voyage embed error: ${await res.text()}`);
  const data = await res.json();
  return (data.data as { embedding: number[] }[]).map((d) => d.embedding);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Embed a single query string (optimized for retrieval).
 * Returns null if provider key is missing — caller falls back to full-scan.
 */
export async function embedQuery(text: string): Promise<number[] | null> {
  if (!text.trim()) return null;
  try {
    const cfg = await getEmbeddingConfig();
    const vecs = await embedBatch([text], cfg, "query");
    return vecs[0] ?? null;
  } catch (err) {
    console.error("[embedding] query embed failed:", err);
    return null;
  }
}

/**
 * Embed a batch of document chunks (optimized for storage/retrieval).
 */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const cfg = await getEmbeddingConfig();
  return embedBatch(texts, cfg, "document");
}

async function embedBatch(
  texts: string[],
  cfg: EmbeddingConfig,
  mode: "query" | "document"
): Promise<number[][]> {
  const inputType =
    mode === "query" ? cfg.input_type_query : cfg.input_type_doc;

  switch (cfg.provider) {
    case "cohere":
      return embedCohere(texts, cfg.model, inputType);
    case "openai":
      return embedOpenAI(texts, cfg.model);
    case "google":
      return embedGoogle(texts, cfg.model);
    case "voyage":
      return embedVoyage(texts, cfg.model, inputType);
    default:
      throw new Error(`Unknown embedding provider: ${cfg.provider}`);
  }
}

// Legacy shim used by old rag.ts (Google-only path)
export async function embedText(text: string): Promise<number[] | null> {
  return embedQuery(text);
}

/**
 * RAG ingestion pipeline:
 * text/URL → clean → chunk → embed → store in documents + chunks tables.
 */

import { getServiceClient } from "@/lib/supabase/service";
import { embedDocuments, getEmbeddingConfig } from "./embeddings";

// ─── Text chunking ────────────────────────────────────────────────────────────

function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token for Latin, ~2 for Persian
  return Math.ceil(text.length / 3);
}

export function chunkText(
  text: string,
  chunkSize = 500,
  overlap = 50
): string[] {
  // Split by sentence boundaries first, then by size
  const sentences = text
    .split(/(?<=[.!?؟\n])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);

    if (currentTokens + sentenceTokens > chunkSize && current) {
      chunks.push(current.trim());
      // Keep overlap from the end of the previous chunk
      const words = current.split(/\s+/);
      const overlapWords = words.slice(-Math.ceil(overlap * 0.8));
      current = overlapWords.join(" ") + " " + sentence;
      currentTokens = estimateTokens(current);
    } else {
      current += (current ? " " : "") + sentence;
      currentTokens += sentenceTokens;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.filter((c) => c.length > 20);
}

// ─── Text extraction from URLs ────────────────────────────────────────────────

async function fetchUrlText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; BeurBot/1.0; +https://beurseason.com)",
    },
  });
  if (!res.ok) throw new Error(`URL fetch failed: ${res.status}`);
  const html = await res.text();

  // Strip HTML tags, scripts, styles
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ─── Main ingestion function ──────────────────────────────────────────────────

export interface IngestOptions {
  title: string;
  sourceType: "text" | "url" | "pdf" | "word";
  content?: string;     // for text / pre-extracted content
  sourceUrl?: string;   // for URL ingestion
  tags?: string[];
}

export async function ingestDocument(opts: IngestOptions): Promise<string> {
  const sb = getServiceClient();
  const cfg = await getEmbeddingConfig();

  // 1. Create document record (status: processing)
  const { data: doc, error: docErr } = await sb
    .from("documents")
    .insert({
      title: opts.title,
      source_type: opts.sourceType,
      source_url: opts.sourceUrl ?? null,
      tags: opts.tags ?? [],
      status: "processing",
    })
    .select("id")
    .single();

  if (docErr || !doc) throw new Error(`Failed to create document: ${docErr?.message}`);
  const documentId = doc.id;

  try {
    // 2. Get raw text
    let rawText: string;
    if (opts.sourceType === "url" && opts.sourceUrl) {
      rawText = await fetchUrlText(opts.sourceUrl);
    } else if (opts.content) {
      rawText = opts.content;
    } else {
      throw new Error("No content provided");
    }

    // 3. Chunk
    const chunks = chunkText(rawText, cfg.chunk_size, cfg.chunk_overlap);
    if (!chunks.length) throw new Error("No chunks extracted from content");

    // 4. Embed all chunks in batches of 50
    const BATCH_SIZE = 50;
    const allEmbeddings: number[][] = [];
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const embeddings = await embedDocuments(batch);
      allEmbeddings.push(...embeddings);
    }

    // 5. Delete old chunks for this document (for re-index)
    await sb.from("chunks").delete().eq("document_id", documentId);

    // 6. Insert new chunks
    const rows = chunks.map((content, idx) => ({
      document_id: documentId,
      content,
      embedding: allEmbeddings[idx] ? `[${allEmbeddings[idx].join(",")}]` : null,
      token_count: estimateTokens(content),
      chunk_index: idx,
      metadata: { source_type: opts.sourceType, title: opts.title },
    }));

    const { error: chunkErr } = await sb.from("chunks").insert(rows);
    if (chunkErr) throw new Error(`Failed to insert chunks: ${chunkErr.message}`);

    // 7. Update document status
    await sb
      .from("documents")
      .update({ status: "indexed", chunk_count: chunks.length })
      .eq("id", documentId);

    return documentId;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await sb
      .from("documents")
      .update({ status: "error", error_msg: msg })
      .eq("id", documentId);
    throw err;
  }
}

export async function reindexDocument(documentId: string): Promise<void> {
  const sb = getServiceClient();
  const cfg = await getEmbeddingConfig();

  const { data: doc } = await sb
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();

  if (!doc) throw new Error("Document not found");

  await sb.from("documents").update({ status: "processing" }).eq("id", documentId);

  try {
    let rawText: string;
    if (doc.source_type === "url" && doc.source_url) {
      rawText = await fetchUrlText(doc.source_url);
    } else {
      // Get content from first chunk (was stored from original text)
      const { data: existingChunks } = await sb
        .from("chunks")
        .select("content")
        .eq("document_id", documentId)
        .order("chunk_index");
      rawText = (existingChunks ?? []).map((c) => c.content).join(" ");
    }

    const chunks = chunkText(rawText, cfg.chunk_size, cfg.chunk_overlap);
    const allEmbeddings: number[][] = [];
    const BATCH_SIZE = 50;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const embeddings = await embedDocuments(batch);
      allEmbeddings.push(...embeddings);
    }

    await sb.from("chunks").delete().eq("document_id", documentId);

    const rows = chunks.map((content, idx) => ({
      document_id: documentId,
      content,
      embedding: allEmbeddings[idx] ? `[${allEmbeddings[idx].join(",")}]` : null,
      token_count: estimateTokens(content),
      chunk_index: idx,
      metadata: { source_type: doc.source_type, title: doc.title },
    }));

    await sb.from("chunks").insert(rows);
    await sb.from("documents").update({ status: "indexed", chunk_count: chunks.length }).eq("id", documentId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await sb.from("documents").update({ status: "error", error_msg: msg }).eq("id", documentId);
    throw err;
  }
}

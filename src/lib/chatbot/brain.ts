/**
 * Core chatbot brain — "One Brain, Multiple Channels".
 * ALL generation goes through OpenRouter (single key, OpenAI-compatible API).
 * Loads system prompt and model config from DB; falls back to safe defaults.
 * Supports both streaming (ReadableStream) and non-streaming modes.
 */

import { getServiceClient } from "@/lib/supabase/service";
import { searchKnowledge } from "./rag";
import {
  loadSession,
  saveSession,
  saveLongTermMemory,
  type ChatMessage,
} from "./memory";
import { OPENAI_TOOLS, executeTool } from "./tools";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BrainInput {
  message: string;
  sessionId: string;
  locale?: string;
  surface?: "web" | "telegram" | "widget";
  conversationId?: string;
}

export interface BrainOutput {
  reply: string;
  sessionId: string;
  conversationId?: string;
  retrievedChunkIds: string[];
  tokensIn: number;
  tokensOut: number;
  modelUsed: string;
}

// ─── Config loading ────────────────────────────────────────────────────────────

interface ModelCfg {
  active_model: string;
  temperature: number;
  max_tokens: number;
  top_p: number;
  fallback_model: string;
}

let _modelCfgCache: Map<string, { cfg: ModelCfg; ts: number }> = new Map();
let _promptCache: { prompt: string; welcome: string; quickReplies: string[]; ts: number } | null = null;
const CFG_TTL = 60_000;

async function loadModelConfig(channel: string): Promise<ModelCfg> {
  const cached = _modelCfgCache.get(channel);
  if (cached && Date.now() - cached.ts < CFG_TTL) return cached.cfg;

  const DEFAULT: ModelCfg = {
    active_model: "anthropic/claude-haiku-4-5-20251001",
    temperature: 0.7,
    max_tokens: 1024,
    top_p: 1.0,
    fallback_model: "google/gemini-2.5-flash",
  };

  try {
    const sb = getServiceClient();
    // Try channel-specific config first, then 'all'
    type DBRow = {
      channel: string;
      active_model: string;
      temperature: number;
      max_tokens: number;
      top_p: number;
      fallback_model: string;
      schedule: unknown[];
    };

    const { data } = await sb
      .from("model_config")
      .select("channel,active_model,temperature,max_tokens,top_p,fallback_model,schedule")
      .in("channel", [channel, "all"])
      .order("channel", { ascending: false })
      .limit(2);

    if (data && data.length > 0) {
      const rows = data as DBRow[];
      const row = rows.find((r) => r.channel === channel) ?? rows[0];

      // Check schedule overrides (day-of-week / time-based model swap)
      const cfg: ModelCfg = {
        active_model: row.active_model ?? DEFAULT.active_model,
        temperature: row.temperature ?? DEFAULT.temperature,
        max_tokens: row.max_tokens ?? DEFAULT.max_tokens,
        top_p: row.top_p ?? DEFAULT.top_p,
        fallback_model: row.fallback_model ?? DEFAULT.fallback_model,
      };

      if (row.schedule && Array.isArray(row.schedule) && row.schedule.length > 0) {
        const now = new Date();
        const day = now.getDay();
        const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

        for (const s of row.schedule as { day?: number; from?: string; to?: string; model?: string }[]) {
          if (s.day !== undefined && s.day !== day) continue;
          if (s.from && s.to && s.model) {
            if (timeStr >= s.from && timeStr <= s.to) {
              cfg.active_model = s.model;
              break;
            }
          }
        }
      }

      _modelCfgCache.set(channel, { cfg, ts: Date.now() });
      return cfg;
    }
  } catch {
    // DB not ready
  }

  return DEFAULT;
}

async function loadSystemPrompt(): Promise<{
  prompt: string;
  welcome: string;
  quickReplies: string[];
}> {
  if (_promptCache && Date.now() - _promptCache.ts < CFG_TTL) {
    return {
      prompt: _promptCache.prompt,
      welcome: _promptCache.welcome,
      quickReplies: _promptCache.quickReplies,
    };
  }

  const DEFAULT_PROMPT = `تو یک دستیار هوشمند فارسی‌زبان برای مجموعه BEUR SEASON هستی. حرفه‌ای، گرم و صادق باش. هدفت راهنمایی کاربران به سمت مشاوره تخصصی زیبایی است.
اطلاعات از پایگاه دانش:
{RAG_CONTEXT}
حافظه این کاربر:
{LONG_TERM_MEMORY}`;

  try {
    const sb = getServiceClient();
    const { data } = await sb
      .from("prompt_versions")
      .select("content,welcome_msg,quick_replies")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (data) {
      _promptCache = {
        prompt: data.content ?? DEFAULT_PROMPT,
        welcome: data.welcome_msg ?? "",
        quickReplies: Array.isArray(data.quick_replies) ? data.quick_replies : [],
        ts: Date.now(),
      };
      return { prompt: _promptCache.prompt, welcome: _promptCache.welcome, quickReplies: _promptCache.quickReplies };
    }
  } catch {
    // DB not ready
  }

  return { prompt: DEFAULT_PROMPT, welcome: "", quickReplies: [] };
}

export function invalidateBrainCache() {
  _modelCfgCache.clear();
  _promptCache = null;
}

// ─── OpenRouter call ──────────────────────────────────────────────────────────

interface OAMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: unknown[];
  tool_call_id?: string;
  name?: string;
}

async function callOpenRouter(
  model: string,
  systemPrompt: string,
  messages: OAMessage[],
  opts: { temperature: number; max_tokens: number; top_p: number; tools?: unknown[] }
): Promise<{ content: string; tokens_in: number; tokens_out: number; tool_calls?: unknown[] }> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY not set");

  const body: Record<string, unknown> = {
    model,
    temperature: opts.temperature,
    max_tokens: opts.max_tokens,
    top_p: opts.top_p,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
  };

  if (opts.tools && opts.tools.length > 0) {
    body.tools = opts.tools;
    body.tool_choice = "auto";
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://beurseason.com",
      "X-Title": "BEUR SEASON Assistant",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter ${model}: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];

  return {
    content: choice?.message?.content ?? "",
    tokens_in: data.usage?.prompt_tokens ?? 0,
    tokens_out: data.usage?.completion_tokens ?? 0,
    tool_calls: choice?.message?.tool_calls,
  };
}

// ─── Streaming variant ────────────────────────────────────────────────────────

export async function streamMessage(input: BrainInput): Promise<ReadableStream<Uint8Array>> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    const encoder = new TextEncoder();
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("data: " + JSON.stringify({ content: "سرویس در دسترس نیست." }) + "\n\n"));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
  }

  const { message, sessionId, locale = "fa", surface = "web" } = input;

  const [ragResult, { messages: history, longTermMemory }, { prompt: promptTemplate }, cfg] = await Promise.all([
    searchKnowledge(message),
    loadSession(sessionId),
    loadSystemPrompt(),
    loadModelConfig(surface),
  ]);

  const systemPrompt = promptTemplate
    .replace("{RAG_CONTEXT}", ragResult.context || "اطلاعاتی در پایگاه دانش یافت نشد.")
    .replace("{LONG_TERM_MEMORY}", longTermMemory || "اطلاعاتی ذخیره نشده.");

  const oaMessages: OAMessage[] = [
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: message },
  ];

  const bodyPayload = {
    model: cfg.active_model,
    temperature: cfg.temperature,
    max_tokens: cfg.max_tokens,
    top_p: cfg.top_p,
    stream: true,
    messages: [{ role: "system", content: systemPrompt }, ...oaMessages],
  };

  const encoder = new TextEncoder();

  const upstreamRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://beurseason.com",
      "X-Title": "BEUR SEASON Assistant",
    },
    body: JSON.stringify(bodyPayload),
  });

  if (!upstreamRes.ok || !upstreamRes.body) {
    const fallback = locale === "fa" ? "خطا در ارتباط با سرور." : "Server error.";
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("data: " + JSON.stringify({ content: fallback }) + "\n\n"));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
  }

  let fullReply = "";
  const reader = upstreamRes.body.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const lines = text.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              break;
            }
            try {
              const parsed = JSON.parse(payload);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                fullReply += delta;
                controller.enqueue(
                  encoder.encode("data: " + JSON.stringify({ content: delta }) + "\n\n")
                );
              }
            } catch {
              // Skip malformed chunks
            }
          }
        }
      } finally {
        controller.close();
        // Persist the conversation asynchronously
        if (fullReply) {
          const newMessages = [
            ...history,
            { role: "user" as const, content: message },
            { role: "assistant" as const, content: fullReply },
          ];
          await saveSession(sessionId, newMessages).catch(() => undefined);
          await logMessage(sessionId, message, fullReply, cfg.active_model, ragResult.chunk_ids, surface).catch(() => undefined);
        }
      }
    },
  });
}

// ─── Non-streaming processMessage ────────────────────────────────────────────

export async function processMessage(input: BrainInput): Promise<BrainOutput> {
  const { message, sessionId, locale = "fa", surface = "web" } = input;

  const [ragResult, { messages: history, longTermMemory }, { prompt: promptTemplate }, cfg] = await Promise.all([
    searchKnowledge(message),
    loadSession(sessionId),
    loadSystemPrompt(),
    loadModelConfig(surface),
  ]);

  const systemPrompt = promptTemplate
    .replace("{RAG_CONTEXT}", ragResult.context || "اطلاعاتی در پایگاه دانش یافت نشد.")
    .replace("{LONG_TERM_MEMORY}", longTermMemory || "اطلاعاتی ذخیره نشده.");

  const oaMessages: OAMessage[] = [
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: message },
  ];

  let reply = "";
  let tokensIn = 0;
  let tokensOut = 0;
  let modelUsed = cfg.active_model;

  // ── Attempt 1: Primary model with tool use ──────────────────────────────
  try {
    const result = await callOpenRouter(cfg.active_model, systemPrompt, oaMessages, {
      temperature: cfg.temperature,
      max_tokens: cfg.max_tokens,
      top_p: cfg.top_p,
      tools: OPENAI_TOOLS,
    });

    tokensIn += result.tokens_in;
    tokensOut += result.tokens_out;
    modelUsed = cfg.active_model;

    // Handle tool calls
    if (result.tool_calls && result.tool_calls.length > 0) {
      const toolCallResults = await processToolCalls(result.tool_calls as ToolCall[], sessionId);

      // Build follow-up messages with tool results
      const withToolMessages: OAMessage[] = [
        ...oaMessages,
        { role: "assistant", content: null, tool_calls: result.tool_calls },
        ...toolCallResults,
      ];

      const followUp = await callOpenRouter(cfg.active_model, systemPrompt, withToolMessages, {
        temperature: cfg.temperature,
        max_tokens: cfg.max_tokens,
        top_p: cfg.top_p,
      });

      reply = followUp.content;
      tokensIn += followUp.tokens_in;
      tokensOut += followUp.tokens_out;
    } else {
      reply = result.content;
    }
  } catch (err) {
    console.error(`[brain] Primary model ${cfg.active_model} failed:`, err);

    // ── Attempt 2: Fallback model ──────────────────────────────────────────
    if (cfg.fallback_model) {
      try {
        const fallback = await callOpenRouter(cfg.fallback_model, systemPrompt, oaMessages, {
          temperature: cfg.temperature,
          max_tokens: cfg.max_tokens,
          top_p: cfg.top_p,
        });
        reply = fallback.content;
        tokensIn = fallback.tokens_in;
        tokensOut = fallback.tokens_out;
        modelUsed = cfg.fallback_model;
      } catch (fallbackErr) {
        console.error("[brain] Fallback model failed:", fallbackErr);
      }
    }
  }

  if (!reply) {
    reply =
      locale === "fa"
        ? "در حال حاضر در دسترس نیستم. لطفاً کمی بعد دوباره تلاش کنید."
        : "Currently unavailable. Please try again later.";
  }

  // Persist session
  const updatedMessages: ChatMessage[] = [
    ...history,
    { role: "user", content: message },
    { role: "assistant", content: reply },
  ];
  await saveSession(sessionId, updatedMessages);

  // Log to messages table async
  logMessage(sessionId, message, reply, modelUsed, ragResult.chunk_ids, surface, tokensIn, tokensOut).catch(() => undefined);

  return {
    reply,
    sessionId,
    retrievedChunkIds: ragResult.chunk_ids,
    tokensIn,
    tokensOut,
    modelUsed,
  };
}

// ─── Tool call processing (OpenAI format) ────────────────────────────────────

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

async function processToolCalls(
  toolCalls: ToolCall[],
  sessionId: string
): Promise<OAMessage[]> {
  const results: OAMessage[] = [];

  for (const tc of toolCalls) {
    let toolInput: Record<string, string> = {};
    try {
      toolInput = JSON.parse(tc.function.arguments);
    } catch {
      toolInput = {};
    }

    const toolResult = await executeTool(tc.function.name, toolInput, sessionId);

    // Save long-term memory when lead is captured
    if (tc.function.name === "capture_lead") {
      const promises = [];
      if (toolInput.name) promises.push(saveLongTermMemory(sessionId, "name", toolInput.name));
      if (toolInput.phone) promises.push(saveLongTermMemory(sessionId, "phone", toolInput.phone));
      if (toolInput.email) promises.push(saveLongTermMemory(sessionId, "email", toolInput.email));
      await Promise.allSettled(promises);
    }

    results.push({
      role: "tool",
      tool_call_id: tc.id,
      content: toolResult,
      name: tc.function.name,
    });
  }

  return results;
}

// ─── Logging to messages table ────────────────────────────────────────────────

async function logMessage(
  sessionId: string,
  userContent: string,
  assistantContent: string,
  modelUsed: string,
  chunkIds: string[],
  channel: string,
  tokensIn = 0,
  tokensOut = 0
) {
  try {
    const sb = getServiceClient();

    // Upsert conversation
    const { data: conv } = await sb
      .from("conversations")
      .upsert(
        { session_id: sessionId, channel, updated_at: new Date().toISOString() },
        { onConflict: "session_id" }
      )
      .select("id")
      .single();

    if (!conv) return;

    // Insert user + assistant messages
    await sb.from("messages").insert([
      { conversation_id: conv.id, role: "user", content: userContent, model_used: null },
      {
        conversation_id: conv.id,
        role: "assistant",
        content: assistantContent,
        model_used: modelUsed,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        retrieved_chunk_ids: chunkIds,
      },
    ]);
  } catch {
    // Non-critical: logging failure doesn't break the conversation
  }
}

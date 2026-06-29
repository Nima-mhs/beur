"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  total_conversations?: number;
  total_messages?: number;
  unique_users?: number;
  total_leads?: number;
  positive_feedback?: number;
  negative_feedback?: number;
  total_tokens_in?: number;
  total_tokens_out?: number;
  web_conversations?: number;
  telegram_conversations?: number;
  widget_conversations?: number;
  total_docs?: number;
  total_chunks?: number;
}

interface Document {
  id: string;
  title: string;
  source_type: string;
  source_url?: string;
  status: string;
  tags: string[];
  chunk_count: number;
  error_msg?: string;
  created_at: string;
}

interface EmbeddingConfig {
  id?: string;
  provider: string;
  model: string;
  dimensions: number;
  chunk_size: number;
  chunk_overlap: number;
  top_k: number;
  similarity_threshold: number;
  reranker_enabled: boolean;
  reranker_model?: string;
}

interface ModelConfig {
  id?: string;
  channel: string;
  provider: string;
  active_model: string;
  temperature: number;
  max_tokens: number;
  top_p: number;
  fallback_model: string;
  cost_limit_usd?: number;
}

interface PromptVersion {
  id: string;
  name: string;
  content: string;
  persona?: string;
  is_active: boolean;
  welcome_msg?: string;
  quick_replies?: string[];
  created_at: string;
}

interface Conversation {
  id: string;
  channel: string;
  external_user_id?: string;
  status: string;
  summary?: string;
  started_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  role: string;
  content: string;
  model_used?: string;
  tokens_in?: number;
  tokens_out?: number;
  retrieved_chunk_ids?: string[];
  created_at: string;
}

interface FeedbackItem {
  id: string;
  rating: number;
  comment?: string;
  created_at: string;
  messages?: { content: string; model_used: string };
}

// ─── Model catalog (OpenRouter slugs) ─────────────────────────────────────────

const MODEL_OPTIONS = [
  { group: "Anthropic (Claude)", slug: "anthropic/claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 — سریع، مودب، ارزان" },
  { group: "Anthropic (Claude)", slug: "anthropic/claude-sonnet-4-5",         label: "Claude Sonnet 4.5 — قوی‌تر" },
  { group: "Google (Gemini)",    slug: "google/gemini-2.5-flash",              label: "Gemini 2.5 Flash — ارزان، context بزرگ" },
  { group: "Google (Gemini)",    slug: "google/gemini-2.5-flash-lite",         label: "Gemini 2.5 Flash Lite — سریع‌ترین" },
  { group: "OpenAI",             slug: "openai/gpt-4o-mini",                   label: "GPT-4o Mini — فارسی خوب" },
  { group: "Qwen",               slug: "qwen/qwen-2.5-72b-instruct",           label: "Qwen 2.5 72B — چندزبانه، ارزان" },
];

const EMBEDDING_OPTIONS = [
  { provider: "cohere",  model: "embed-multilingual-v3.0",    dimensions: 1024, label: "Cohere multilingual v3 (1024)" },
  { provider: "openai",  model: "text-embedding-3-small",     dimensions: 1536, label: "OpenAI 3-small (1536)" },
  { provider: "openai",  model: "text-embedding-3-large",     dimensions: 3072, label: "OpenAI 3-large (3072)" },
  { provider: "google",  model: "text-multilingual-embedding-002", dimensions: 768, label: "Google Multilingual (768)" },
  { provider: "voyage",  model: "voyage-multilingual-2",      dimensions: 1024, label: "Voyage multilingual-2 (1024)" },
];

const TABS = [
  { key: "dashboard",    label: "داشبورد",         icon: "📊" },
  { key: "knowledge",    label: "پایگاه دانش",     icon: "📚" },
  { key: "embedding",    label: "Embedding",        icon: "🔢" },
  { key: "models",       label: "مدل‌های AI",      icon: "🤖" },
  { key: "prompt",       label: "پرسونا و Prompt", icon: "✏️" },
  { key: "conversations",label: "گفتگوها",          icon: "💬" },
  { key: "handoff",      label: "تحویل اپراتور",   icon: "🙋" },
  { key: "feedback",     label: "بازخورد",          icon: "👍" },
  { key: "channels",     label: "کانال‌ها",         icon: "📡" },
  { key: "playground",   label: "پلی‌گراند",        icon: "🧪" },
  { key: "settings",     label: "تنظیمات",          icon: "⚙️" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n?: number) {
  return (n ?? 0).toLocaleString("fa-IR");
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("fa-IR", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    indexed:    "bg-emerald-100 text-emerald-700",
    processing: "bg-blue-100 text-blue-700 animate-pulse",
    pending:    "bg-yellow-100 text-yellow-700",
    error:      "bg-red-100 text-red-700",
    active:     "bg-green-100 text-green-700",
    waiting_human: "bg-orange-100 text-orange-700",
    human_active:  "bg-purple-100 text-purple-700",
    closed:     "bg-gray-100 text-gray-500",
  };
  const labels: Record<string, string> = {
    indexed: "ایندکس شده", processing: "در حال پردازش", pending: "در انتظار",
    error: "خطا", active: "فعال", waiting_human: "منتظر اپراتور",
    human_active: "اپراتور فعال", closed: "بسته شده",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {labels[status] ?? status}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ChatbotAdminClient() {
  const router = useRouter();
  const supabase = createClient();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [authHeader, setAuthHeader] = useState("");
  const [tab, setTab] = useState<TabKey>("dashboard");

  // ── Auth ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/fa/auth/login"); return; }

      const meRes = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const me = await meRes.json();
      if (me.role !== "admin") { setAuthorized(false); return; }

      setAuthHeader(`Bearer ${session.access_token}`);
      setAuthorized(true);
    }
    check();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (authorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="h-8 w-8 border-2 border-ink border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="surface-card p-8 text-center space-y-3 max-w-sm">
          <p className="text-2xl">🚫</p>
          <p className="font-medium text-ink">دسترسی محدود</p>
          <p className="text-sm text-charcoal/70">این صفحه فقط برای ادمین در دسترس است.</p>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[var(--bg)] font-vazir">
      {/* ── Topbar ── */}
      <header className="sticky top-0 z-30 border-b border-gold/20 bg-ink/95 backdrop-blur-sm">
        <div className="container-content flex items-center gap-3 py-3">
          <button onClick={() => router.push("/fa/admin")} className="text-gold/60 hover:text-gold transition-colors text-sm">
            ← پنل اصلی
          </button>
          <span className="text-sand/30">|</span>
          <span className="font-cormorant text-gold font-semibold">مدیریت چت‌بات</span>
        </div>
      </header>

      <div className="container-content py-6 pb-20">
        <div className="flex gap-6">
          {/* ── Sidebar tabs ── */}
          <aside className="w-44 flex-shrink-0">
            <nav className="flex flex-col gap-1 sticky top-20">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-right transition-all ${
                    tab === t.key
                      ? "bg-ink text-gold font-medium shadow-sm"
                      : "text-charcoal hover:bg-sand/30"
                  }`}
                >
                  <span className="text-base">{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </nav>
          </aside>

          {/* ── Main content ── */}
          <main className="flex-1 min-w-0">
            {tab === "dashboard"     && <DashboardTab    auth={authHeader} />}
            {tab === "knowledge"     && <KnowledgeTab    auth={authHeader} />}
            {tab === "embedding"     && <EmbeddingTab    auth={authHeader} />}
            {tab === "models"        && <ModelsTab       auth={authHeader} />}
            {tab === "prompt"        && <PromptTab       auth={authHeader} />}
            {tab === "conversations" && <ConversationsTab auth={authHeader} />}
            {tab === "handoff"       && <HandoffTab      auth={authHeader} />}
            {tab === "feedback"      && <FeedbackTab     auth={authHeader} />}
            {tab === "channels"      && <ChannelsTab     auth={authHeader} />}
            {tab === "playground"    && <PlaygroundTab   auth={authHeader} />}
            {tab === "settings"      && <SettingsTab     auth={authHeader} />}
          </main>
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD TAB ────────────────────────────────────────────────────────────

function DashboardTab({ auth }: { auth: string }) {
  const [stats, setStats] = useState<Stats>({});
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/chatbot/stats?days=${days}`, { headers: { Authorization: auth } })
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, [auth, days]);

  const statCards = [
    { label: "گفتگوها",     value: stats.total_conversations, icon: "💬" },
    { label: "پیام‌ها",     value: stats.total_messages,      icon: "📨" },
    { label: "کاربران یکتا", value: stats.unique_users,        icon: "👤" },
    { label: "لیدها",       value: stats.total_leads,         icon: "🎯" },
    { label: "بازخورد +",   value: stats.positive_feedback,   icon: "👍" },
    { label: "بازخورد -",   value: stats.negative_feedback,   icon: "👎" },
    { label: "توکن ورودی",  value: stats.total_tokens_in,     icon: "🔤" },
    { label: "توکن خروجی",  value: stats.total_tokens_out,    icon: "🔡" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-ink">داشبورد</h2>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-xl border border-sand bg-paper px-3 py-1.5 text-sm text-ink outline-none"
        >
          {[7, 14, 30, 90].map((d) => (
            <option key={d} value={d}>{d} روز اخیر</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="surface-card p-4 animate-pulse h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {statCards.map((c) => (
            <div key={c.label} className="surface-card p-4 space-y-2 rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs text-charcoal/60">{c.label}</span>
                <span className="text-lg">{c.icon}</span>
              </div>
              <p className="text-2xl font-bold text-ink">{fmtNum(c.value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Channel breakdown */}
      <div className="surface-card p-5 rounded-2xl space-y-3">
        <h3 className="font-medium text-ink">تفکیک کانال</h3>
        {[
          { label: "وب",      value: stats.web_conversations,      color: "bg-blue-400" },
          { label: "تلگرام", value: stats.telegram_conversations,  color: "bg-sky-400" },
          { label: "ویجت",   value: stats.widget_conversations,    color: "bg-purple-400" },
        ].map((ch) => {
          const total = (stats.total_conversations ?? 1) || 1;
          const pct = Math.round(((ch.value ?? 0) / total) * 100);
          return (
            <div key={ch.label} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-charcoal/70">{ch.label}</span>
                <span className="text-ink font-medium">{fmtNum(ch.value)} ({pct}%)</span>
              </div>
              <div className="h-2 rounded-full bg-sand/30 overflow-hidden">
                <div className={`h-full ${ch.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* KB summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="surface-card p-4 rounded-2xl">
          <p className="text-xs text-charcoal/60 mb-1">اسناد ایندکس شده</p>
          <p className="text-3xl font-bold text-ink">{fmtNum(stats.total_docs)}</p>
        </div>
        <div className="surface-card p-4 rounded-2xl">
          <p className="text-xs text-charcoal/60 mb-1">تعداد Chunk‌ها</p>
          <p className="text-3xl font-bold text-ink">{fmtNum(stats.total_chunks)}</p>
        </div>
      </div>
    </div>
  );
}

// ─── KNOWLEDGE BASE TAB ───────────────────────────────────────────────────────

function KnowledgeTab({ auth }: { auth: string }) {
  const [docs, setDocs]         = useState<Document[]>([]);
  const [loading, setLoading]   = useState(true);
  const [adding, setAdding]     = useState(false);
  const [form, setForm]         = useState({ title: "", sourceType: "text", content: "", sourceUrl: "", tags: "" });
  const [processing, setProc]   = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/chatbot/documents", { headers: { Authorization: auth } })
      .then((r) => r.json())
      .then((d) => setDocs(d.documents ?? []))
      .finally(() => setLoading(false));
  }, [auth]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    setProc("adding");
    try {
      await fetch("/api/admin/chatbot/documents", {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          sourceType: form.sourceType,
          content: form.content || undefined,
          sourceUrl: form.sourceUrl || undefined,
          tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      setAdding(false);
      setForm({ title: "", sourceType: "text", content: "", sourceUrl: "", tags: "" });
      setTimeout(load, 1000);
    } finally {
      setProc(null);
    }
  }

  async function handleReindex(id: string) {
    setProc(id);
    await fetch("/api/admin/chatbot/documents", {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reindex", documentId: id }),
    });
    setTimeout(load, 1000);
    setProc(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("این سند و تمام chunk‌هایش حذف می‌شود. ادامه؟")) return;
    await fetch("/api/admin/chatbot/documents", {
      method: "DELETE",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: id }),
    });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-ink">پایگاه دانش</h2>
        <button onClick={() => setAdding(true)} className="btn-primary text-sm px-4 py-2">
          + افزودن منبع
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="surface-card p-5 rounded-2xl space-y-4">
          <h3 className="font-medium text-ink">منبع جدید</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-charcoal/60 mb-1">عنوان *</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/30"
                placeholder="عنوان سند"
              />
            </div>
            <div>
              <label className="block text-xs text-charcoal/60 mb-1">نوع منبع *</label>
              <select
                value={form.sourceType}
                onChange={(e) => setForm((f) => ({ ...f, sourceType: e.target.value }))}
                className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm outline-none"
              >
                <option value="text">متن</option>
                <option value="url">URL</option>
              </select>
            </div>
          </div>
          {form.sourceType === "url" ? (
            <div>
              <label className="block text-xs text-charcoal/60 mb-1">آدرس URL *</label>
              <input
                type="url"
                dir="ltr"
                value={form.sourceUrl}
                onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
                className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/30"
                placeholder="https://..."
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs text-charcoal/60 mb-1">محتوای متنی *</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                rows={6}
                className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/30 resize-none"
                placeholder="متن سند را اینجا وارد کنید..."
              />
            </div>
          )}
          <div>
            <label className="block text-xs text-charcoal/60 mb-1">تگ‌ها (با کاما جدا کنید)</label>
            <input
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/30"
              placeholder="services, faq, pricing"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setAdding(false)} className="btn-secondary flex-1">انصراف</button>
            <button
              onClick={handleAdd}
              disabled={!form.title || processing === "adding"}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {processing === "adding" ? "در حال پردازش..." : "ایندکس کن"}
            </button>
          </div>
        </div>
      )}

      {/* Documents list */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-7 w-7 border-2 border-ink border-t-transparent rounded-full animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <div className="surface-card p-10 text-center rounded-2xl">
          <p className="text-4xl mb-3">📚</p>
          <p className="text-charcoal/60">هیچ سندی در پایگاه دانش وجود ندارد.</p>
          <p className="text-sm text-charcoal/40 mt-1">برای شروع یک منبع اضافه کنید.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => (
            <div key={doc.id} className="surface-card p-4 rounded-2xl">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-ink">{doc.title}</span>
                    <StatusBadge status={doc.status} />
                    <span className="rounded-full bg-sand/30 px-2 py-0.5 text-[10px] text-charcoal/60">
                      {doc.source_type}
                    </span>
                  </div>
                  {doc.source_url && (
                    <a href={doc.source_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-gold underline" dir="ltr">
                      {doc.source_url}
                    </a>
                  )}
                  <div className="flex items-center gap-3 text-xs text-charcoal/50">
                    <span>{fmtNum(doc.chunk_count)} chunk</span>
                    <span>{fmtDate(doc.created_at)}</span>
                    {doc.tags?.length > 0 && (
                      <span>{doc.tags.join(" · ")}</span>
                    )}
                  </div>
                  {doc.error_msg && (
                    <p className="text-xs text-red-500 bg-red-50 rounded px-2 py-1">{doc.error_msg}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReindex(doc.id)}
                    disabled={processing === doc.id}
                    className="text-xs btn-ghost !px-3 !py-1.5 disabled:opacity-50"
                  >
                    {processing === doc.id ? "..." : "↻ Re-index"}
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="text-xs text-red-500 hover:text-red-700 transition-colors px-2"
                  >
                    حذف
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── EMBEDDING CONFIG TAB ─────────────────────────────────────────────────────

function EmbeddingTab({ auth }: { auth: string }) {
  const [cfg, setCfg] = useState<EmbeddingConfig>({
    provider: "cohere", model: "embed-multilingual-v3.0", dimensions: 1024,
    chunk_size: 500, chunk_overlap: 50, top_k: 5, similarity_threshold: 0.5,
    reranker_enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const originalModelRef = useRef(cfg.model);

  useEffect(() => {
    fetch("/api/admin/chatbot/config?type=embedding", { headers: { Authorization: auth } })
      .then((r) => r.json())
      .then((d) => {
        if (d.embedding) {
          setCfg((prev) => ({ ...prev, ...d.embedding }));
          originalModelRef.current = d.embedding.model;
        }
      })
      .finally(() => setLoading(false));
  }, [auth]);

  function handleModelChange(opt: typeof EMBEDDING_OPTIONS[0]) {
    if (opt.model !== originalModelRef.current) setShowWarning(true);
    setCfg((c) => ({ ...c, provider: opt.provider, model: opt.model, dimensions: opt.dimensions }));
  }

  async function save() {
    setSaving(true);
    await fetch("/api/admin/chatbot/config", {
      method: "PUT",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "embedding", ...cfg }),
    });
    setSaving(false);
    setSaved(true);
    originalModelRef.current = cfg.model;
    setShowWarning(false);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <div className="flex justify-center py-10"><div className="h-7 w-7 border-2 border-ink border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-ink">تنظیمات Embedding</h2>

      {showWarning && (
        <div className="rounded-xl border border-amber-400 bg-amber-50 p-4 text-sm text-amber-800">
          ⚠️ تغییر مدل embedding نیاز به بازسازی کل ایندکس دارد. پس از ذخیره، از بخش پایگاه دانش همه اسناد را Re-index کنید.
          <br />ابعاد ستون embedding در دیتابیس باید با مدل جدید هماهنگ باشد (ALTER TABLE chunks ALTER COLUMN embedding TYPE vector({cfg.dimensions})).
        </div>
      )}

      {/* Model selection */}
      <div className="surface-card p-5 rounded-2xl space-y-4">
        <h3 className="font-medium text-ink">مدل Embedding</h3>
        <div className="grid gap-2">
          {EMBEDDING_OPTIONS.map((opt) => (
            <label key={opt.model} className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
              cfg.model === opt.model ? "border-gold bg-gold/5" : "border-sand hover:border-gold/40"
            }`}>
              <input
                type="radio"
                name="embedModel"
                checked={cfg.model === opt.model}
                onChange={() => handleModelChange(opt)}
                className="accent-ink"
              />
              <div>
                <p className="text-sm font-medium text-ink">{opt.label}</p>
                <p className="text-xs text-charcoal/50" dir="ltr">{opt.provider} · {opt.model}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Retrieval settings */}
      <div className="surface-card p-5 rounded-2xl space-y-4">
        <h3 className="font-medium text-ink">تنظیمات Chunking و Retrieval</h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: "chunk_size",     label: "اندازه Chunk (توکن)",  min: 100,  max: 2000 },
            { key: "chunk_overlap",  label: "Overlap (توکن)",        min: 0,    max: 200  },
            { key: "top_k",          label: "تعداد نتایج (top_k)",  min: 1,    max: 20   },
          ].map((f) => (
            <div key={f.key}>
              <label className="block text-xs text-charcoal/60 mb-1">{f.label}</label>
              <input
                type="number"
                min={f.min}
                max={f.max}
                value={cfg[f.key as keyof EmbeddingConfig] as number}
                onChange={(e) => setCfg((c) => ({ ...c, [f.key]: Number(e.target.value) }))}
                className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/30"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs text-charcoal/60 mb-1">آستانه شباهت (0–1)</label>
            <input
              type="number"
              min={0} max={1} step={0.05}
              value={cfg.similarity_threshold}
              onChange={(e) => setCfg((c) => ({ ...c, similarity_threshold: Number(e.target.value) }))}
              className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/30"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={cfg.reranker_enabled}
            onChange={(e) => setCfg((c) => ({ ...c, reranker_enabled: e.target.checked }))}
            className="accent-ink"
          />
          <span className="text-sm text-charcoal/80">فعال‌سازی Reranker (Cohere rerank-multilingual)</span>
        </label>
      </div>

      <button onClick={save} disabled={saving} className="btn-primary px-8 py-2.5 disabled:opacity-50">
        {saving ? "در حال ذخیره..." : saved ? "✓ ذخیره شد" : "ذخیره تنظیمات"}
      </button>
    </div>
  );
}

// ─── MODELS TAB ───────────────────────────────────────────────────────────────

function ModelsTab({ auth }: { auth: string }) {
  const [configs, setConfigs] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState<string | null>(null);
  const [saved, setSaved]     = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/chatbot/config?type=model", { headers: { Authorization: auth } })
      .then((r) => r.json())
      .then((d) => setConfigs(d.models ?? []))
      .finally(() => setLoading(false));
  }, [auth]);

  const defaultCfg = (channel: string): ModelConfig => ({
    channel,
    provider: "anthropic",
    active_model: "anthropic/claude-haiku-4-5-20251001",
    temperature: 0.7,
    max_tokens: 1024,
    top_p: 1.0,
    fallback_model: "google/gemini-2.5-flash",
    cost_limit_usd: 10,
  });

  const getConfig = (ch: string) =>
    configs.find((c) => c.channel === ch) ?? defaultCfg(ch);

  async function saveChannel(channel: string, patch: Partial<ModelConfig>) {
    setSaving(channel);
    const current = getConfig(channel);
    await fetch("/api/admin/chatbot/config", {
      method: "PUT",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "model", ...current, ...patch, channel }),
    });
    setSaving(null);
    setSaved(channel);
    setTimeout(() => setSaved(null), 2000);
    const res = await fetch("/api/admin/chatbot/config?type=model", { headers: { Authorization: auth } });
    const d = await res.json();
    setConfigs(d.models ?? []);
  }

  if (loading) return <div className="flex justify-center py-10"><div className="h-7 w-7 border-2 border-ink border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-ink">تنظیمات مدل‌های AI</h2>

      {["all", "web", "telegram", "widget"].map((ch) => {
        const cfg = getConfig(ch);
        const chLabel = { all: "همه کانال‌ها", web: "صفحه وب", telegram: "تلگرام", widget: "ویجت" }[ch];

        return (
          <div key={ch} className="surface-card p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-ink">{chLabel}</h3>
              {saved === ch && <span className="text-xs text-emerald-600">✓ ذخیره شد</span>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-charcoal/60 mb-1">مدل اصلی</label>
                <select
                  value={cfg.active_model}
                  onChange={(e) => {
                    const found = MODEL_OPTIONS.find((m) => m.slug === e.target.value);
                    setConfigs((prev) => {
                      const idx = prev.findIndex((c) => c.channel === ch);
                      const next = idx >= 0 ? [...prev] : [...prev, { ...defaultCfg(ch) }];
                      if (idx >= 0) next[idx] = { ...next[idx], active_model: e.target.value, provider: found?.group.split(" ")[0].toLowerCase() ?? "anthropic" };
                      else next[next.length - 1] = { ...next[next.length - 1], active_model: e.target.value };
                      return next;
                    });
                  }}
                  className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm outline-none"
                >
                  {MODEL_OPTIONS.map((m) => (
                    <option key={m.slug} value={m.slug}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-charcoal/60 mb-1">مدل Fallback</label>
                <select
                  value={cfg.fallback_model}
                  onChange={(e) => setConfigs((prev) => {
                    const next = [...prev];
                    const idx = next.findIndex((c) => c.channel === ch);
                    if (idx >= 0) next[idx] = { ...next[idx], fallback_model: e.target.value };
                    return next;
                  })}
                  className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm outline-none"
                >
                  {MODEL_OPTIONS.map((m) => (
                    <option key={m.slug} value={m.slug}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-charcoal/60 mb-1">Temperature</label>
                <input
                  type="number" min={0} max={2} step={0.1}
                  value={cfg.temperature}
                  onChange={(e) => setConfigs((prev) => {
                    const next = [...prev];
                    const idx = next.findIndex((c) => c.channel === ch);
                    if (idx >= 0) next[idx] = { ...next[idx], temperature: Number(e.target.value) };
                    return next;
                  })}
                  className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-charcoal/60 mb-1">Max Tokens</label>
                <input
                  type="number" min={100} max={8000}
                  value={cfg.max_tokens}
                  onChange={(e) => setConfigs((prev) => {
                    const next = [...prev];
                    const idx = next.findIndex((c) => c.channel === ch);
                    if (idx >= 0) next[idx] = { ...next[idx], max_tokens: Number(e.target.value) };
                    return next;
                  })}
                  className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-charcoal/60 mb-1">سقف هزینه ($)</label>
                <input
                  type="number" min={1}
                  value={cfg.cost_limit_usd ?? 10}
                  onChange={(e) => setConfigs((prev) => {
                    const next = [...prev];
                    const idx = next.findIndex((c) => c.channel === ch);
                    if (idx >= 0) next[idx] = { ...next[idx], cost_limit_usd: Number(e.target.value) };
                    return next;
                  })}
                  className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm outline-none"
                />
              </div>
            </div>

            <button
              onClick={() => saveChannel(ch, cfg)}
              disabled={saving === ch}
              className="btn-primary text-sm px-6 py-2 disabled:opacity-50"
            >
              {saving === ch ? "ذخیره..." : "ذخیره"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── PROMPT TAB ───────────────────────────────────────────────────────────────

function PromptTab({ auth }: { auth: string }) {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [editing, setEditing]   = useState<PromptVersion | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [newV, setNewV]         = useState({ name: "", content: "", persona: "", welcome_msg: "" });
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/chatbot/prompt", { headers: { Authorization: auth } })
      .then((r) => r.json())
      .then((d) => setVersions(d.versions ?? []))
      .finally(() => setLoading(false));
  }, [auth]);

  useEffect(() => { load(); }, [load]);

  async function activate(id: string) {
    setSaving(true);
    await fetch("/api/admin/chatbot/prompt", {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "activate", id }),
    });
    setSaving(false);
    load();
  }

  async function createVersion() {
    if (!newV.content.trim()) return;
    setSaving(true);
    await fetch("/api/admin/chatbot/prompt", {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ ...newV }),
    });
    setSaving(false);
    setCreating(false);
    setNewV({ name: "", content: "", persona: "", welcome_msg: "" });
    load();
  }

  if (loading) return <div className="flex justify-center py-10"><div className="h-7 w-7 border-2 border-ink border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-ink">پرسونا و System Prompt</h2>
        <button onClick={() => setCreating(true)} className="btn-primary text-sm px-4 py-2">
          + نسخه جدید
        </button>
      </div>

      {creating && (
        <div className="surface-card p-5 rounded-2xl space-y-4">
          <h3 className="font-medium text-ink">ایجاد نسخه جدید</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-charcoal/60 mb-1">نام نسخه</label>
              <input
                value={newV.name}
                onChange={(e) => setNewV((v) => ({ ...v, name: e.target.value }))}
                className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm outline-none"
                placeholder="v2 - گرم‌تر"
              />
            </div>
            <div>
              <label className="block text-xs text-charcoal/60 mb-1">خلاصه پرسونا</label>
              <input
                value={newV.persona}
                onChange={(e) => setNewV((v) => ({ ...v, persona: e.target.value }))}
                className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm outline-none"
                placeholder="دستیار تخصصی زیبایی"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-charcoal/60 mb-1">System Prompt *</label>
            <textarea
              value={newV.content}
              onChange={(e) => setNewV((v) => ({ ...v, content: e.target.value }))}
              rows={10}
              className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm outline-none font-mono resize-none"
              placeholder="تو یک دستیار..."
            />
          </div>
          <div>
            <label className="block text-xs text-charcoal/60 mb-1">پیام خوش‌آمد</label>
            <textarea
              value={newV.welcome_msg}
              onChange={(e) => setNewV((v) => ({ ...v, welcome_msg: e.target.value }))}
              rows={3}
              className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm outline-none resize-none"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setCreating(false)} className="btn-secondary flex-1">انصراف</button>
            <button onClick={createVersion} disabled={saving || !newV.content} className="btn-primary flex-1 disabled:opacity-50">
              {saving ? "..." : "ذخیره"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {versions.map((v) => (
          <div key={v.id} className={`surface-card p-4 rounded-2xl border-2 transition-colors ${v.is_active ? "border-gold" : "border-transparent"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-ink">{v.name}</span>
                  {v.is_active && <span className="rounded-full bg-gold/20 text-gold text-xs px-2 py-0.5 font-medium">● فعال</span>}
                </div>
                {v.persona && <p className="text-xs text-charcoal/50 mb-2">{v.persona}</p>}
                <pre className="text-xs text-charcoal/70 bg-sand/20 rounded-lg p-3 overflow-auto max-h-32 font-mono whitespace-pre-wrap">
                  {v.content.slice(0, 300)}{v.content.length > 300 ? "..." : ""}
                </pre>
                <p className="text-xs text-charcoal/30 mt-2">{fmtDate(v.created_at)}</p>
              </div>
              <div className="flex flex-col gap-2">
                {!v.is_active && (
                  <button
                    onClick={() => activate(v.id)}
                    disabled={saving}
                    className="text-xs btn-primary !px-3 !py-1.5"
                  >
                    فعال کن
                  </button>
                )}
                <button
                  onClick={() => setEditing(v)}
                  className="text-xs btn-ghost !px-3 !py-1.5"
                >
                  مشاهده
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="surface-card w-full max-w-2xl p-6 space-y-4 rounded-2xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-ink">{editing.name}</h3>
              <button onClick={() => setEditing(null)} className="text-charcoal/50 hover:text-charcoal text-lg">✕</button>
            </div>
            <pre className="text-sm text-charcoal/80 bg-sand/20 rounded-xl p-4 font-mono whitespace-pre-wrap overflow-auto">
              {editing.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CONVERSATIONS TAB ────────────────────────────────────────────────────────

function ConversationsTab({ auth }: { auth: string }) {
  const [convs, setConvs]     = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState({ channel: "", status: "" });

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (filter.channel) params.set("channel", filter.channel);
    if (filter.status)  params.set("status",  filter.status);
    fetch(`/api/admin/chatbot/conversations?${params}`, { headers: { Authorization: auth } })
      .then((r) => r.json())
      .then((d) => setConvs(d.conversations ?? []))
      .finally(() => setLoading(false));
  }, [auth, filter]);

  useEffect(() => { load(); }, [load]);

  async function openConversation(id: string) {
    setSelected(id);
    const res = await fetch(`/api/admin/chatbot/conversations?id=${id}`, { headers: { Authorization: auth } });
    const d = await res.json();
    setMessages(d.messages ?? []);
  }

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-ink">گفتگوها (Inbox)</h2>

      <div className="flex gap-3">
        <select
          value={filter.channel}
          onChange={(e) => setFilter((f) => ({ ...f, channel: e.target.value }))}
          className="rounded-xl border border-sand bg-paper px-3 py-2 text-sm outline-none"
        >
          <option value="">همه کانال‌ها</option>
          <option value="web">وب</option>
          <option value="telegram">تلگرام</option>
          <option value="widget">ویجت</option>
        </select>
        <select
          value={filter.status}
          onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
          className="rounded-xl border border-sand bg-paper px-3 py-2 text-sm outline-none"
        >
          <option value="">همه وضعیت‌ها</option>
          <option value="active">فعال</option>
          <option value="waiting_human">منتظر اپراتور</option>
          <option value="closed">بسته</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="h-7 w-7 border-2 border-ink border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2 overflow-auto max-h-[60vh]">
            {convs.map((c) => (
              <button
                key={c.id}
                onClick={() => openConversation(c.id)}
                className={`w-full text-right surface-card p-3 rounded-xl transition-all hover:shadow-md ${selected === c.id ? "ring-2 ring-gold" : ""}`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-sand/30 rounded px-1.5 py-0.5">{c.channel}</span>
                    <StatusBadge status={c.status} />
                  </div>
                  <span className="text-[10px] text-charcoal/40">{fmtDate(c.updated_at)}</span>
                </div>
                {c.summary && <p className="text-xs text-charcoal/60 truncate">{c.summary}</p>}
                {c.external_user_id && (
                  <p className="text-[10px] text-charcoal/30 font-mono mt-0.5" dir="ltr">{c.external_user_id}</p>
                )}
              </button>
            ))}
          </div>

          {selected && (
            <div className="surface-card rounded-2xl p-4 overflow-auto max-h-[60vh] space-y-3">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                    m.role === "user" ? "bg-sand/30 text-ink" : "bg-ink text-sand"
                  }`} dir="auto">
                    {m.content}
                    {m.model_used && <p className="text-[10px] opacity-40 mt-1" dir="ltr">{m.model_used}</p>}
                    {m.retrieved_chunk_ids && m.retrieved_chunk_ids.length > 0 && (
                      <p className="text-[10px] opacity-40">{m.retrieved_chunk_ids.length} chunk بازیابی شد</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── HANDOFF TAB ──────────────────────────────────────────────────────────────

function HandoffTab({ auth }: { auth: string }) {
  const [queue, setQueue] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/chatbot/conversations?status=waiting_human&limit=30", { headers: { Authorization: auth } })
      .then((r) => r.json())
      .then((d) => setQueue(d.conversations ?? []))
      .finally(() => setLoading(false));
  }, [auth]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id: string, status: string) {
    await fetch("/api/admin/chatbot/conversations", {
      method: "PATCH",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-ink">صف تحویل به اپراتور</h2>
        <span className="rounded-full bg-orange-100 text-orange-700 text-sm px-3 py-1 font-medium">
          {queue.length} در صف
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="h-7 w-7 border-2 border-ink border-t-transparent rounded-full animate-spin" /></div>
      ) : queue.length === 0 ? (
        <div className="surface-card p-10 text-center rounded-2xl">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-charcoal/60">هیچ گفتگویی در صف انتظار نیست.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((c) => (
            <div key={c.id} className="surface-card p-4 rounded-2xl">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-sand/30 rounded px-1.5 py-0.5">{c.channel}</span>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-xs text-charcoal/50">{fmtDate(c.updated_at)}</p>
                  {c.external_user_id && (
                    <p className="text-[10px] text-charcoal/30 font-mono" dir="ltr">{c.external_user_id}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateStatus(c.id, "human_active")}
                    className="btn-primary text-xs !px-3 !py-1.5"
                  >
                    قبول
                  </button>
                  <button
                    onClick={() => updateStatus(c.id, "active")}
                    className="btn-secondary text-xs !px-3 !py-1.5"
                  >
                    برگشت به بات
                  </button>
                  <button
                    onClick={() => updateStatus(c.id, "closed")}
                    className="btn-ghost text-xs !px-3 !py-1.5"
                  >
                    بستن
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── FEEDBACK TAB ─────────────────────────────────────────────────────────────

function FeedbackTab({ auth }: { auth: string }) {
  const [items, setItems]   = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<-1 | 1 | 0>(0);

  useEffect(() => {
    setLoading(true);
    const params = filter !== 0 ? `?rating=${filter}` : "";
    fetch(`/api/admin/chatbot/feedback${params}`, { headers: { Authorization: auth } })
      .then((r) => r.json())
      .then((d) => setItems(d.feedback ?? []))
      .finally(() => setLoading(false));
  }, [auth, filter]);

  const pos = items.filter((i) => i.rating === 1).length;
  const neg = items.filter((i) => i.rating === -1).length;
  const rate = items.length ? Math.round((pos / items.length) * 100) : 0;

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-ink">بازخورد کاربران</h2>

      <div className="grid grid-cols-3 gap-4">
        <div className="surface-card p-4 rounded-2xl text-center">
          <p className="text-2xl font-bold text-emerald-600">{fmtNum(pos)}</p>
          <p className="text-xs text-charcoal/60 mt-1">👍 مثبت</p>
        </div>
        <div className="surface-card p-4 rounded-2xl text-center">
          <p className="text-2xl font-bold text-red-500">{fmtNum(neg)}</p>
          <p className="text-xs text-charcoal/60 mt-1">👎 منفی</p>
        </div>
        <div className="surface-card p-4 rounded-2xl text-center">
          <p className="text-2xl font-bold text-ink">{rate}%</p>
          <p className="text-xs text-charcoal/60 mt-1">نرخ رضایت</p>
        </div>
      </div>

      <div className="flex gap-2">
        {([0, 1, -1] as const).map((r) => (
          <button
            key={r}
            onClick={() => setFilter(r)}
            className={`rounded-xl px-3 py-1.5 text-sm transition-all ${filter === r ? "bg-ink text-gold" : "bg-sand/20 text-charcoal hover:bg-sand/40"}`}
          >
            {r === 0 ? "همه" : r === 1 ? "👍 مثبت" : "👎 منفی"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="h-7 w-7 border-2 border-ink border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="surface-card p-4 rounded-2xl space-y-2">
              <div className="flex items-start gap-3">
                <span className="text-xl">{item.rating === 1 ? "👍" : "👎"}</span>
                <div className="flex-1">
                  {item.messages?.content && (
                    <p className="text-sm text-ink line-clamp-2">{item.messages.content}</p>
                  )}
                  {item.comment && (
                    <p className="text-xs text-charcoal/60 mt-1 bg-sand/20 rounded px-2 py-1">{item.comment}</p>
                  )}
                  <div className="flex gap-3 mt-1.5 text-[10px] text-charcoal/40">
                    {item.messages?.model_used && <span dir="ltr">{item.messages.model_used}</span>}
                    <span>{fmtDate(item.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CHANNELS TAB ─────────────────────────────────────────────────────────────

function ChannelsTab({ auth }: { auth: string }) {
  const [tgToken, setTgToken]   = useState(process.env.NEXT_PUBLIC_TG_SET ? "***" : "");
  const [widgetDomains, setWd]  = useState("*");
  const [broadcastMsg, setBcMsg] = useState("");
  const [broadcastRes, setBcRes] = useState<{ sent?: number; failed?: number } | null>(null);
  const [broadcasting, setBc]   = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://beurseason.com";

  const embedCode = `<script>
  (function(){
    var s = document.createElement('script');
    s.src = '${origin}/api/widget/widget.js';
    s.setAttribute('data-origin', '${origin}');
    s.setAttribute('data-position', 'bottom-right');
    s.async = true;
    document.head.appendChild(s);
  })();
</script>`;

  async function broadcast() {
    if (!broadcastMsg.trim()) return;
    setBc(true);
    const res = await fetch("/api/admin/chatbot/broadcast", {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ message: broadcastMsg, channel: "telegram" }),
    });
    const d = await res.json();
    setBcRes(d);
    setBc(false);
  }

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-ink">کانال‌ها و یکپارچه‌سازی</h2>

      {/* Telegram */}
      <div className="surface-card p-5 rounded-2xl space-y-4">
        <h3 className="font-medium text-ink">🤖 تلگرام</h3>
        <div>
          <label className="block text-xs text-charcoal/60 mb-1">توکن ربات (TELEGRAM_BOT_TOKEN در .env.local)</label>
          <input
            type="password"
            value={tgToken}
            onChange={(e) => setTgToken(e.target.value)}
            dir="ltr"
            className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm font-mono outline-none"
            placeholder="123456789:AAF..."
          />
          <p className="text-xs text-charcoal/40 mt-1">برای تنظیم Webhook: https://api.telegram.org/bot&#123;TOKEN&#125;/setWebhook?url={origin}/api/telegram</p>
        </div>

        <div>
          <h4 className="text-sm font-medium text-ink mb-3">ارسال پیام انبوه (Broadcast)</h4>
          <textarea
            value={broadcastMsg}
            onChange={(e) => setBcMsg(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm outline-none resize-none"
            placeholder="پیام خود را بنویسید..."
          />
          {broadcastRes && (
            <p className="text-sm text-emerald-600 mt-2">
              ✓ ارسال شد به {broadcastRes.sent ?? 0} کاربر
              {broadcastRes.failed ? ` (${broadcastRes.failed} ناموفق)` : ""}
            </p>
          )}
          <button
            onClick={broadcast}
            disabled={broadcasting || !broadcastMsg.trim()}
            className="btn-primary text-sm px-5 py-2 mt-2 disabled:opacity-50"
          >
            {broadcasting ? "در حال ارسال..." : "ارسال به همه"}
          </button>
        </div>
      </div>

      {/* Widget */}
      <div className="surface-card p-5 rounded-2xl space-y-4">
        <h3 className="font-medium text-ink">🌐 ویجت قابل Embed</h3>
        <div>
          <label className="block text-xs text-charcoal/60 mb-1">دامنه‌های مجاز (با کاما جدا کنید یا * برای همه)</label>
          <input
            value={widgetDomains}
            onChange={(e) => setWd(e.target.value)}
            dir="ltr"
            className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm font-mono outline-none"
            placeholder="example.com, app.example.com"
          />
        </div>
        <div>
          <label className="block text-xs text-charcoal/60 mb-1">کد نصب</label>
          <pre className="text-xs text-charcoal/80 bg-ink/5 rounded-xl p-4 overflow-auto font-mono whitespace-pre-wrap" dir="ltr">
            {embedCode}
          </pre>
          <button
            onClick={() => navigator.clipboard.writeText(embedCode)}
            className="btn-secondary text-xs px-4 py-1.5 mt-2"
          >
            کپی کد
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PLAYGROUND TAB ───────────────────────────────────────────────────────────

function PlaygroundTab({ auth }: { auth: string }) {
  const [query, setQuery]   = useState("");
  const [modelA, setModelA] = useState("anthropic/claude-haiku-4-5-20251001");
  const [modelB, setModelB] = useState("google/gemini-2.5-flash");
  const [topK, setTopK]     = useState(5);
  const [threshold, setThreshold] = useState(0.5);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!query.trim()) return;
    setLoading(true);
    const res = await fetch("/api/admin/chatbot/playground", {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ query, modelA, modelB, topK, threshold }),
    });
    setResult(await res.json());
    setLoading(false);
  }

  const chunks = (result?.chunks as Array<{ content: string; similarity: number; doc_title: string }>) ?? [];
  const resA = result?.modelA as { response: string; tokens_in: number; tokens_out: number; latency_ms: number } | undefined;
  const resB = result?.modelB as { response: string; tokens_in: number; tokens_out: number; latency_ms: number } | undefined;

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-ink">پلی‌گراند و تست</h2>

      <div className="surface-card p-5 rounded-2xl space-y-4">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm outline-none resize-none"
          placeholder="سوال خود را بنویسید..."
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-charcoal/60 mb-1">مدل A</label>
            <select value={modelA} onChange={(e) => setModelA(e.target.value)} className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm outline-none">
              {MODEL_OPTIONS.map((m) => <option key={m.slug} value={m.slug}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-charcoal/60 mb-1">مدل B (مقایسه)</label>
            <select value={modelB} onChange={(e) => setModelB(e.target.value)} className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm outline-none">
              {MODEL_OPTIONS.map((m) => <option key={m.slug} value={m.slug}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-charcoal/60 mb-1">top_k</label>
            <input type="number" min={1} max={20} value={topK} onChange={(e) => setTopK(Number(e.target.value))} className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm outline-none" />
          </div>
          <div>
            <label className="block text-xs text-charcoal/60 mb-1">آستانه</label>
            <input type="number" min={0} max={1} step={0.05} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full rounded-xl border border-sand bg-paper px-3 py-2 text-sm outline-none" />
          </div>
        </div>
        <button onClick={run} disabled={loading || !query.trim()} className="btn-primary px-6 py-2.5 disabled:opacity-50">
          {loading ? "در حال اجرا..." : "اجرا"}
        </button>
      </div>

      {result && (
        <>
          {/* Chunks */}
          <div className="surface-card p-5 rounded-2xl space-y-3">
            <h3 className="font-medium text-ink">Chunk‌های بازیابی شده ({chunks.length})</h3>
            {chunks.map((c, i) => (
              <div key={i} className="bg-sand/20 rounded-xl p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-ink">{c.doc_title}</span>
                  <span className="text-xs text-charcoal/50">{Math.round(c.similarity * 100)}% شباهت</span>
                </div>
                <p className="text-xs text-charcoal/70 line-clamp-3">{c.content}</p>
              </div>
            ))}
          </div>

          {/* Model comparison */}
          {(resA || resB) && (
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "مدل A", data: resA, model: modelA },
                { label: "مدل B", data: resB, model: modelB },
              ].map(({ label, data, model }) => data && (
                <div key={label} className="surface-card p-4 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-ink text-sm">{label}</span>
                    <span className="text-[10px] text-charcoal/40" dir="ltr">{data.latency_ms}ms</span>
                  </div>
                  <p className="text-[10px] text-charcoal/40" dir="ltr">{model}</p>
                  <p className="text-sm text-charcoal/80 bg-sand/20 rounded-xl p-3 whitespace-pre-wrap" dir="auto">{data.response}</p>
                  <p className="text-[10px] text-charcoal/40">
                    {fmtNum(data.tokens_in)} in · {fmtNum(data.tokens_out)} out
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── SETTINGS TAB ─────────────────────────────────────────────────────────────

function SettingsTab({ auth: _auth }: { auth: string }) {
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-ink">تنظیمات و امنیت</h2>

      <div className="surface-card p-5 rounded-2xl space-y-4">
        <h3 className="font-medium text-ink">کلیدهای API</h3>
        <p className="text-sm text-charcoal/60">کلیدهای API را در فایل <code className="bg-sand/20 rounded px-1">.env.local</code> تنظیم کنید:</p>
        <div className="bg-ink/5 rounded-xl p-4 font-mono text-xs space-y-1.5" dir="ltr">
          {[
            "OPENROUTER_API_KEY=sk-or-v1-...",
            "COHERE_API_KEY=...      # embedding",
            "OPENAI_API_KEY=...      # embedding",
            "GOOGLE_AI_API_KEY=...   # embedding + analysis",
            "VOYAGE_API_KEY=...      # embedding",
            "TELEGRAM_BOT_TOKEN=...",
            "NEXT_PUBLIC_SUPABASE_URL=...",
            "NEXT_PUBLIC_SUPABASE_ANON_KEY=...",
          ].map((line) => (
            <p key={line} className="text-charcoal/70">{line}</p>
          ))}
        </div>
      </div>

      <div className="surface-card p-5 rounded-2xl space-y-3">
        <h3 className="font-medium text-ink">اطلاعات سیستم</h3>
        {[
          { label: "نسخه RAG Schema", value: "v2 (chunks + documents)" },
          { label: "پشتیبانی Streaming", value: "✅ SSE (/api/chatbot/stream)" },
          { label: "پشتیبانی Tool Use", value: "✅ OpenAI format (OpenRouter)" },
          { label: "embedding پیش‌فرض", value: "Cohere embed-multilingual-v3.0 (1024d)" },
        ].map((r) => (
          <div key={r.label} className="flex items-center justify-between py-2 border-b border-sand/20 last:border-0">
            <span className="text-sm text-charcoal/60">{r.label}</span>
            <span className="text-sm text-ink font-medium">{r.value}</span>
          </div>
        ))}
      </div>

      <div className="surface-card p-5 rounded-2xl space-y-3">
        <h3 className="font-medium text-ink">راهنمای Migration</h3>
        <ol className="text-sm text-charcoal/70 space-y-2 list-decimal list-inside">
          <li>ابتدا <code className="bg-sand/20 rounded px-1">supabase/chatbot_v2.sql</code> را اجرا کنید.</li>
          <li>کلیدهای API را در .env.local تنظیم کنید.</li>
          <li>در بخش Embedding، مدل مورد نظر را انتخاب کنید.</li>
          <li>در بخش پایگاه دانش، اسناد را آپلود و ایندکس کنید.</li>
          <li>برای تغییر مدل embedding، باید ابعاد ستون را در دیتابیس تغییر دهید و Re-index کنید.</li>
        </ol>
      </div>
    </div>
  );
}

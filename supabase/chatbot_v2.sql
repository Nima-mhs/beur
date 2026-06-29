-- =============================================
-- BEUR SEASON — Chatbot v2 Full Schema
-- Run AFTER schema.sql and chatbot.sql
-- Supabase SQL editor:
-- https://supabase.com/dashboard/project/zpxnyrqoeyjqcgzxnmry/sql
-- =============================================

-- Enable pgvector if not already
create extension if not exists vector;

-- ─── 1. DOCUMENTS (knowledge source metadata) ────────────────────────────────
-- Tracks the original source files/URLs; chunks table holds the actual pieces.
create table if not exists public.documents (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  source_type text not null check (source_type in ('text', 'pdf', 'url', 'word')),
  source_url  text,
  status      text not null default 'pending'
                check (status in ('pending', 'processing', 'indexed', 'error')),
  tags        text[] default '{}',
  chunk_count int default 0,
  error_msg   text,
  created_at  timestamptz default now()
);

alter table public.documents disable row level security;

-- ─── 2. CHUNKS (actual RAG content with embeddings) ──────────────────────────
-- Default vector dim = 1024 (Cohere/Voyage).
-- To change: ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(<dim>);
-- Then re-index all documents from the admin panel.
create table if not exists public.chunks (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid references public.documents(id) on delete cascade,
  content      text not null,
  embedding    vector(1024),   -- change dim when switching embedding models
  token_count  int,
  chunk_index  int not null default 0,
  metadata     jsonb default '{}'::jsonb,
  created_at   timestamptz default now()
);

alter table public.chunks disable row level security;

create index if not exists chunks_doc_idx
  on public.chunks (document_id);

create index if not exists chunks_embedding_idx
  on public.chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ─── 3. CONVERSATIONS ────────────────────────────────────────────────────────
create table if not exists public.conversations (
  id               uuid primary key default gen_random_uuid(),
  channel          text not null check (channel in ('web', 'telegram', 'widget')),
  external_user_id text,            -- telegram chat_id, widget fingerprint, etc.
  session_id       text unique,     -- links to chat_sessions for backwards compat
  status           text not null default 'active'
                     check (status in ('active', 'waiting_human', 'human_active', 'closed')),
  summary          text,            -- auto-summary of long conversations
  lead_id          uuid,            -- set when lead is captured
  started_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

alter table public.conversations disable row level security;

create index if not exists conversations_session_idx on public.conversations (session_id);
create index if not exists conversations_channel_idx on public.conversations (channel);
create index if not exists conversations_status_idx  on public.conversations (status);

-- ─── 4. MESSAGES ─────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id                  uuid primary key default gen_random_uuid(),
  conversation_id     uuid references public.conversations(id) on delete cascade,
  role                text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content             text not null,
  model_used          text,
  tokens_in           int default 0,
  tokens_out          int default 0,
  retrieved_chunk_ids uuid[] default '{}',
  tool_name           text,
  latency_ms          int,
  created_at          timestamptz default now()
);

alter table public.messages disable row level security;

create index if not exists messages_conv_idx on public.messages (conversation_id);
create index if not exists messages_role_idx on public.messages (role);
create index if not exists messages_created_idx on public.messages (created_at desc);

-- ─── 5. UNIFIED USERS ────────────────────────────────────────────────────────
create table if not exists public.unified_users (
  id         uuid primary key default gen_random_uuid(),
  channel    text not null check (channel in ('web', 'telegram', 'widget')),
  external_id text not null,
  name       text,
  username   text,
  locale     text default 'fa',
  first_seen timestamptz default now(),
  last_seen  timestamptz default now(),
  constraint unified_users_uq unique (channel, external_id)
);

alter table public.unified_users disable row level security;

-- ─── 6. FEEDBACK ─────────────────────────────────────────────────────────────
create table if not exists public.feedback (
  id             uuid primary key default gen_random_uuid(),
  message_id     uuid references public.messages(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  rating         int check (rating in (-1, 1)),  -- -1 = thumbs down, 1 = thumbs up
  comment        text,
  created_at     timestamptz default now()
);

alter table public.feedback disable row level security;

-- ─── 7. PROMPT VERSIONS ──────────────────────────────────────────────────────
create table if not exists public.prompt_versions (
  id           uuid primary key default gen_random_uuid(),
  name         text not null default 'default',
  content      text not null,          -- the system prompt text
  persona      text,                   -- short persona description
  is_active    bool not null default false,
  welcome_msg  text,                   -- per-channel welcome message override
  quick_replies jsonb default '[]'::jsonb,  -- suggested starter questions
  created_at   timestamptz default now(),
  created_by   text
);

alter table public.prompt_versions disable row level security;

-- ─── 8. MODEL CONFIG ─────────────────────────────────────────────────────────
create table if not exists public.model_config (
  id               uuid primary key default gen_random_uuid(),
  channel          text not null default 'all'
                     check (channel in ('all', 'web', 'telegram', 'widget')),
  provider         text not null default 'anthropic',
  active_model     text not null default 'anthropic/claude-haiku-4-5-20251001',
  temperature      float not null default 0.7,
  max_tokens       int not null default 1024,
  top_p            float not null default 1.0,
  fallback_provider text default 'google',
  fallback_model   text default 'google/gemini-2.5-flash',
  schedule         jsonb default '[]'::jsonb,  -- [{day:0-6, from:"08:00", to:"22:00", model:"..."}]
  cost_limit_usd   float default 10.0,
  updated_at       timestamptz default now(),
  constraint model_config_channel_uq unique (channel)
);

alter table public.model_config disable row level security;

-- ─── 9. EMBEDDING CONFIG ─────────────────────────────────────────────────────
create table if not exists public.embedding_config (
  id                  uuid primary key default gen_random_uuid(),
  provider            text not null default 'cohere'
                        check (provider in ('cohere', 'openai', 'google', 'voyage')),
  model               text not null default 'embed-multilingual-v3.0',
  dimensions          int not null default 1024,
  chunk_size          int not null default 500,
  chunk_overlap       int not null default 50,
  top_k               int not null default 5,
  similarity_threshold float not null default 0.5,
  reranker_enabled    bool not null default false,
  reranker_model      text,
  input_type_doc      text default 'search_document',
  input_type_query    text default 'search_query',
  updated_at          timestamptz default now()
);

alter table public.embedding_config disable row level security;

-- ─── 10. ADMIN USERS ─────────────────────────────────────────────────────────
create table if not exists public.admin_users (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  role       text not null default 'operator'
               check (role in ('owner', 'admin', 'editor', 'operator', 'viewer')),
  created_at timestamptz default now()
);

alter table public.admin_users disable row level security;

-- ─── 11. AUDIT LOG ───────────────────────────────────────────────────────────
create table if not exists public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.admin_users(id) on delete set null,
  action        text not null,
  target        text,
  details       jsonb default '{}'::jsonb,
  created_at    timestamptz default now()
);

alter table public.audit_log disable row level security;

-- ─── 12. RATE LIMIT TRACKING (Telegram) ──────────────────────────────────────
create table if not exists public.rate_limits (
  id          uuid primary key default gen_random_uuid(),
  identifier  text not null,       -- telegram chat_id or IP
  window_start timestamptz not null,
  count       int not null default 1,
  constraint rate_limits_uq unique (identifier, window_start)
);

alter table public.rate_limits disable row level security;

-- ─── RPC FUNCTIONS ───────────────────────────────────────────────────────────

-- Vector similarity search on chunks table (new schema)
create or replace function public.match_chunks(
  query_embedding  vector(1024),
  match_count      int     default 5,
  sim_threshold    float   default 0.5
)
returns table (
  id           uuid,
  document_id  uuid,
  content      text,
  metadata     jsonb,
  similarity   float,
  doc_title    text
)
language plpgsql
as $$
begin
  return query
  select
    c.id,
    c.document_id,
    c.content,
    c.metadata,
    1 - (c.embedding <=> query_embedding) as similarity,
    d.title as doc_title
  from public.chunks c
  join public.documents d on d.id = c.document_id
  where c.embedding is not null
    and d.status = 'indexed'
    and 1 - (c.embedding <=> query_embedding) > sim_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Stats helper for admin dashboard
create or replace function public.chatbot_stats(days_back int default 30)
returns jsonb
language plpgsql
as $$
declare
  result jsonb;
  cutoff timestamptz := now() - (days_back || ' days')::interval;
begin
  select jsonb_build_object(
    'total_conversations',  (select count(*) from public.conversations where started_at >= cutoff),
    'total_messages',       (select count(*) from public.messages where created_at >= cutoff),
    'unique_users',         (select count(distinct external_user_id) from public.conversations where started_at >= cutoff),
    'web_conversations',    (select count(*) from public.conversations where channel='web'      and started_at >= cutoff),
    'telegram_conversations',(select count(*) from public.conversations where channel='telegram' and started_at >= cutoff),
    'widget_conversations', (select count(*) from public.conversations where channel='widget'   and started_at >= cutoff),
    'positive_feedback',    (select count(*) from public.feedback where rating=1  and created_at >= cutoff),
    'negative_feedback',    (select count(*) from public.feedback where rating=-1 and created_at >= cutoff),
    'total_leads',          (select count(*) from public.chatbot_leads where created_at >= cutoff),
    'total_tokens_in',      (select coalesce(sum(tokens_in),0) from public.messages where created_at >= cutoff),
    'total_tokens_out',     (select coalesce(sum(tokens_out),0) from public.messages where created_at >= cutoff),
    'total_docs',           (select count(*) from public.documents where status='indexed'),
    'total_chunks',         (select count(*) from public.chunks)
  ) into result;
  return result;
end;
$$;

-- ─── DEFAULT DATA ─────────────────────────────────────────────────────────────

-- Default model config
insert into public.model_config (channel, provider, active_model, temperature, max_tokens, top_p, fallback_model)
values
  ('all',      'anthropic', 'anthropic/claude-haiku-4-5-20251001', 0.7, 1024, 1.0, 'google/gemini-2.5-flash'),
  ('telegram', 'anthropic', 'anthropic/claude-haiku-4-5-20251001', 0.7, 512,  1.0, 'google/gemini-2.5-flash'),
  ('widget',   'anthropic', 'anthropic/claude-haiku-4-5-20251001', 0.7, 512,  1.0, 'google/gemini-2.5-flash'),
  ('web',      'anthropic', 'anthropic/claude-haiku-4-5-20251001', 0.7, 1024, 1.0, 'google/gemini-2.5-flash')
on conflict (channel) do nothing;

-- Default embedding config (Cohere multilingual, 1024 dims)
insert into public.embedding_config
  (provider, model, dimensions, chunk_size, chunk_overlap, top_k, similarity_threshold)
values
  ('cohere', 'embed-multilingual-v3.0', 1024, 500, 50, 5, 0.5)
on conflict do nothing;

-- Default system prompt
insert into public.prompt_versions (name, content, persona, is_active, welcome_msg, quick_replies)
values (
  'default',
  E'تو یک دستیار هوشمند فارسی‌زبان برای مجموعه BEUR SEASON هستی — اولین سرویس مشاوره زیبایی داده‌محور فارسی‌زبان.\n\nشخصیت: متخصص مطمئن، صادق، گرم و توانمندساز. مثل یک دوست متخصص که راستش را می‌گوید.\nخطاب: همیشه «شما»\nزبان: فارسی (مگر کاربر به انگلیسی بنویسد)\n\nوظایف اصلی:\n- پاسخ به سوالات درباره خدمات BEUR SEASON، رزرو، قیمت و تحلیل رنگ\n- راهنمایی در زمینه Color Season، زیرتُن پوست و انتخاب رنگ\n- هدایت کاربر به ثبت درخواست مشاوره (ابزار capture_lead)\n- بررسی وضعیت رزرو (ابزار check_enrollment_status)\n\nقوانین:\n- پاسخ‌ها را کوتاه و مفید نگه دار (۲-۳ پاراگراف)\n- هرگز اطلاعات نادرست یا ساختگی ندهید\n- مشاوره تخصصی قطعی ندهید؛ هدف راهنمایی و هدایت کاربر به مشاوره واقعی است\n- اگر سوال خارج از حوزه زیبایی/BEUR SEASON است، مودبانه راهنمایی کن\n- اطلاعات از پایگاه دانش:\n{RAG_CONTEXT}\n- حافظه این کاربر:\n{LONG_TERM_MEMORY}',
  'دستیار تخصصی زیبایی BEUR SEASON',
  true,
  'سلام! به BEUR SEASON خوش آمدید 🌸\n\nمن دستیار هوشمند شما هستم و می‌توانم در موارد زیر کمک کنم:\n• تحلیل رنگ فصلی و زیرتُن پوست\n• رزرو مشاوره\n• قیمت خدمات\n\nچه سوالی دارید؟',
  '["تحلیل رنگ فصلی چیست؟", "چطور رزرو مشاوره کنم؟", "قیمت خدمات چقدر است؟", "رنگ مناسب پوست من چیست؟"]'
)
on conflict do nothing;

-- =============================================
-- BEUR SEASON — Chatbot Brain Schema
-- Run this in the Supabase SQL editor AFTER schema.sql:
-- https://supabase.com/dashboard/project/zpxnyrqoeyjqcgzxnmry/sql
-- =============================================

-- Enable pgvector
create extension if not exists vector;

-- 1. Knowledge base for RAG
create table if not exists public.chatbot_documents (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  embedding vector(768),         -- Google text-embedding-004 (768 dims)
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists chatbot_documents_embedding_idx
  on public.chatbot_documents using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 2. Chat sessions (short-term memory — last 20 messages per session)
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text unique not null,
  messages jsonb default '[]'::jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists chat_sessions_session_id_idx
  on public.chat_sessions (session_id);

-- 3. Long-term memory (persisted facts per session/user)
create table if not exists public.chat_memory (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  key text not null,
  value text not null,
  created_at timestamptz default now(),
  constraint chat_memory_uq unique (session_id, key)
);

create index if not exists chat_memory_session_idx
  on public.chat_memory (session_id);

-- 4. Leads captured via chatbot
create table if not exists public.chatbot_leads (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  name text,
  phone text,
  email text,
  interest text,
  notes text,
  source text default 'chatbot',
  created_at timestamptz default now()
);

-- Disable RLS on chatbot tables (accessed via service role / anon)
alter table public.chatbot_documents disable row level security;
alter table public.chat_sessions     disable row level security;
alter table public.chat_memory       disable row level security;
alter table public.chatbot_leads     disable row level security;

-- 5. Vector similarity search RPC
create or replace function public.match_documents(
  query_embedding vector(768),
  match_count     int   default 5,
  similarity_threshold float default 0.6
)
returns table (
  id         uuid,
  content    text,
  metadata   jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) as similarity
  from public.chatbot_documents d
  where d.embedding is not null
    and 1 - (d.embedding <=> query_embedding) > similarity_threshold
  order by d.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- 6. Seed initial knowledge base (Persian)
insert into public.chatbot_documents (content, metadata) values

( 'BEUR SEASON یک سرویس مشاوره زیبایی داده‌محور فارسی‌زبان است. تخصص اصلی ما تحلیل رنگ فصلی (Color Season Analysis) است که شامل ۴ فصل Spring، Summer، Autumn و Winter می‌شود. با تحلیل رنگ پوست، مو و چشم هر فرد، بهترین رنگ‌ها برای آرایش، لباس و رنگ مو را پیشنهاد می‌دهیم. هدف ما توانمندسازی است، نه وابستگی.',
  '{"category": "about", "lang": "fa"}' ),

( 'خدمات BEUR SEASON: ۱) مشاوره رنگ شخصی — جلسه آنلاین تصویری ۶۰ دقیقه، قیمت ۵۰۰٬۰۰۰ تومان. ۲) وبینار و کلاس آنلاین Color Analysis برای علاقه‌مندان و متخصصان (به‌زودی). ۳) خدمات B2B برای سالن‌ها و برندها (به‌زودی). آنالیز رنگ هوشمند رایگان نیز در سایت موجود است.',
  '{"category": "services", "lang": "fa"}' ),

( 'مراحل رزرو مشاوره BEUR SEASON: ۱) در سایت ثبت‌نام کنید یا وارد شوید. ۲) از تقویم یک زمان مناسب انتخاب کنید. ۳) مبلغ ۵۰۰٬۰۰۰ تومان را به حساب بانکی واریز کنید. ۴) بعد از تأیید پرداخت، لینک جلسه آنلاین به ایمیلتان ارسال می‌شود. برای رزرو از طریق چت، نام و شماره تماستان را بدهید.',
  '{"category": "booking", "lang": "fa"}' ),

( 'تحلیل رنگ فصلی (Color Season Analysis): هر فرد در یکی از ۴ فصل قرار می‌گیرد — بهار (Spring): پوست گرم، روشن و زنده. تابستان (Summer): پوست سرد، ملایم و ظریف. پاییز (Autumn): پوست گرم، عمیق و خاکی. زمستان (Winter): پوست سرد، تیره و واضح.',
  '{"category": "color-analysis", "lang": "fa"}' ),

( 'زیرتُن (Undertone) رنگ زیرین پوست است — گرم (Warm)، سرد (Cool) یا خنثی (Neutral). تشخیص: رگ‌های مچ دست را ببینید — سبز = گرم، آبی/بنفش = سرد، هر دو = خنثی. همچنین طلا بر پوست گرم و نقره بر پوست سرد بهتر می‌نشیند.',
  '{"category": "color-analysis", "lang": "fa"}' ),

( 'آنالیز رنگ آنلاین رایگان: در صفحه آنالیز رنگ سایت می‌توانید عکس چهره را آپلود کنید و هوش مصنوعی رنگ فصلی، زیرتُن و بهترین رنگ‌های مو، ابرو و میکاپ را تشخیص می‌دهد. بدون ثبت‌نام و کاملاً رایگان.',
  '{"category": "services", "lang": "fa"}' ),

( 'ارتباط با BEUR SEASON: ایمیل info@beurseason.com. برای رزرو مستقیم یا سوالات، از همین چت استفاده کنید یا به صفحه رزرو سایت مراجعه کنید.',
  '{"category": "contact", "lang": "fa"}' ),

( 'رنگ‌های پیشنهادی بر اساس فصل: بهار — رنگ‌های گرم روشن مثل هلویی، زرد عسلی، سبز پسته. تابستان — رنگ‌های سرد ملایم مثل لیلاک، صورتی کهنه، آبی آسمانی. پاییز — رنگ‌های گرم عمیق مثل قهوه‌ای، نارنجی تیره، سبز جنگلی. زمستان — رنگ‌های سرد واضح مثل سفید برف، مشکی، قرمز تند، آبی سلطنتی.',
  '{"category": "color-analysis", "lang": "fa"}' );

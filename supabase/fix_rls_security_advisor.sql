-- =============================================
-- BEUR SEASON — Fix Supabase Security Advisor "RLS Disabled in Public" errors
-- Run this once in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/zpxnyrqoeyjqcgzxnmry/sql
--
-- Safe to run: every one of these tables is only ever read/written by
-- backend API routes using the SERVICE ROLE client (getServiceClient() in
-- src/lib/supabase/service.ts), never by the browser/anon key directly.
-- The Supabase service_role key always bypasses Row Level Security, so
-- enabling RLS here only blocks direct anon/authenticated access via the
-- public API — it does not change how the app (chatbot included) behaves.
-- No policies are added on purpose: nothing needs anon/authenticated access.
-- =============================================

alter table public.chatbot_documents enable row level security;
alter table public.chat_sessions     enable row level security;
alter table public.chat_memory       enable row level security;
alter table public.chatbot_leads     enable row level security;

alter table public.documents         enable row level security;
alter table public.chunks            enable row level security;
alter table public.conversations     enable row level security;
alter table public.messages          enable row level security;
alter table public.unified_users     enable row level security;
alter table public.feedback          enable row level security;
alter table public.prompt_versions   enable row level security;
alter table public.model_config      enable row level security;
alter table public.embedding_config  enable row level security;
alter table public.admin_users       enable row level security;
alter table public.audit_log         enable row level security;
alter table public.rate_limits       enable row level security;

-- ─── ABOUT PAGE CONTENT (singleton row) ──────────────────────────────────────
-- Editable from admin panel: profile photo, bio/story, and résumé/credentials
-- shown on the public "درباره من" (About) page. No fabricated defaults — the
-- page falls back to its static placeholder copy until the admin fills these in.

create table if not exists public.about_content (
  id           int primary key default 1,
  photo_url    text,
  bio          text,
  resume_items text,
  updated_at   timestamptz default now(),
  constraint about_content_singleton check (id = 1)
);

alter table public.about_content enable row level security;

drop policy if exists "Anyone can view about content" on about_content;
drop policy if exists "Admins can manage about content" on about_content;

-- Public read: shown to any visitor on the About page.
create policy "Anyone can view about content"
  on about_content for select using (true);

create policy "Admins can manage about content"
  on about_content for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

drop trigger if exists about_content_updated_at on about_content;
create trigger about_content_updated_at
  before update on about_content
  for each row execute function public.set_updated_at();

insert into public.about_content (id) values (1) on conflict (id) do nothing;

-- ─── STORAGE: public bucket for the About page photo upload ──────────────────
insert into storage.buckets (id, name, public)
values ('about-photos', 'about-photos', true)
on conflict (id) do nothing;

drop policy if exists "Public read about photos" on storage.objects;
create policy "Public read about photos"
  on storage.objects for select
  using (bucket_id = 'about-photos');

-- No insert/update/delete policy: only the service-role client (admin API route)
-- writes to this bucket, and the service role bypasses RLS entirely.

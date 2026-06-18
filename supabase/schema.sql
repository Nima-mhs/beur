-- =============================================
-- BEUR SEASON — Supabase Database Schema v2
-- Run this in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/zpxnyrqoeyjqcgzxnmry/sql
-- =============================================

-- ─── 1. PROFILES ────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  full_name   text,
  phone       text,
  avatar_url  text,
  locale      text default 'fa',
  role        text default 'user' check (role in ('user', 'admin')),
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile"    on profiles;
drop policy if exists "Users can update own profile"  on profiles;
drop policy if exists "Users can insert own profile"  on profiles;
drop policy if exists "Admins can view all profiles"  on profiles;

create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);
create policy "Admins can view all profiles"
  on profiles for select
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function set_updated_at();


-- ─── 2. TIME SLOTS ──────────────────────────────────────────────────────────
create table if not exists public.time_slots (
  id           uuid default gen_random_uuid() primary key,
  starts_at    timestamptz not null,
  duration_min int default 60 not null,
  available    bool default true not null,
  price_irr    int default 5000000,           -- 500,000 Tomans in Rials
  service      text default 'personal_color_consultation',
  notes        text,
  created_at   timestamptz default now() not null
);

alter table public.time_slots enable row level security;

drop policy if exists "Anyone can view available slots" on time_slots;
drop policy if exists "Admins can manage slots"         on time_slots;

create policy "Anyone can view available slots"
  on time_slots for select using (available = true);
create policy "Admins can manage slots"
  on time_slots for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));


-- ─── 3. BOOKINGS ────────────────────────────────────────────────────────────
create table if not exists public.bookings (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references public.profiles(id) on delete cascade not null,
  slot_id        uuid references public.time_slots(id) not null,
  service        text default 'personal_color_consultation' not null,
  status         text default 'pending_payment' not null
                   check (status in ('pending_payment', 'confirmed', 'completed', 'cancelled', 'refunded')),
  full_name      text not null,
  email          text not null,
  phone          text,
  notes          text,
  meeting_link   text,
  created_at     timestamptz default now() not null,
  updated_at     timestamptz default now() not null
);

alter table public.bookings enable row level security;

drop policy if exists "Users can view own bookings"    on bookings;
drop policy if exists "Users can insert own bookings"  on bookings;
drop policy if exists "Users can update own bookings"  on bookings;
drop policy if exists "Admins can manage all bookings" on bookings;

create policy "Users can view own bookings"
  on bookings for select using (auth.uid() = user_id);
create policy "Users can insert own bookings"
  on bookings for insert with check (auth.uid() = user_id);
create policy "Users can update own bookings"
  on bookings for update using (auth.uid() = user_id);
create policy "Admins can manage all bookings"
  on bookings for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

drop trigger if exists bookings_updated_at on public.bookings;
create trigger bookings_updated_at
  before update on public.bookings
  for each row execute function set_updated_at();

-- Mark slot unavailable when booking is created
create or replace function mark_slot_booked()
returns trigger language plpgsql security definer as $$
begin
  if NEW.status != 'cancelled' then
    update public.time_slots set available = false where id = NEW.slot_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists on_booking_created on public.bookings;
create trigger on_booking_created
  after insert on public.bookings
  for each row execute function mark_slot_booked();

-- Re-enable slot when booking is cancelled/refunded
create or replace function mark_slot_available_on_cancel()
returns trigger language plpgsql security definer as $$
begin
  if NEW.status in ('cancelled', 'refunded') and OLD.status not in ('cancelled', 'refunded') then
    update public.time_slots set available = true where id = NEW.slot_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists on_booking_cancelled on public.bookings;
create trigger on_booking_cancelled
  after update on public.bookings
  for each row execute function mark_slot_available_on_cancel();


-- ─── 4. PAYMENTS ────────────────────────────────────────────────────────────
create table if not exists public.payments (
  id              uuid default gen_random_uuid() primary key,
  booking_id      uuid references public.bookings(id) on delete cascade not null,
  user_id         uuid references public.profiles(id) on delete cascade not null,
  amount_irr      int not null,
  currency        text default 'IRR',
  provider        text not null check (provider in ('stripe', 'zarinpal', 'manual')),
  status          text default 'pending'
                    check (status in ('pending', 'paid', 'failed', 'refunded')),
  provider_ref    text,                       -- Stripe payment_intent_id or Zarinpal Authority
  provider_data   jsonb default '{}'::jsonb,  -- raw webhook payload
  paid_at         timestamptz,
  created_at      timestamptz default now() not null
);

alter table public.payments enable row level security;

drop policy if exists "Users can view own payments"    on payments;
drop policy if exists "Admins can manage all payments" on payments;

create policy "Users can view own payments"
  on payments for select using (auth.uid() = user_id);
create policy "Admins can manage all payments"
  on payments for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Auto-confirm booking when payment succeeds
create or replace function confirm_booking_on_payment()
returns trigger language plpgsql security definer as $$
begin
  if NEW.status = 'paid' and OLD.status != 'paid' then
    update public.bookings set status = 'confirmed' where id = NEW.booking_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists on_payment_confirmed on public.payments;
create trigger on_payment_confirmed
  after update on public.payments
  for each row execute function confirm_booking_on_payment();


-- ─── 5. COLOR ANALYSIS RESULTS ──────────────────────────────────────────────
create table if not exists public.color_analyses (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references public.profiles(id) on delete cascade,  -- null = anonymous
  session_id    text,                           -- links to chat_sessions
  season        text,                           -- Spring / Summer / Autumn / Winter
  season_fa     text,
  undertone     text,
  skin_tone     text,
  analysis_data jsonb default '{}'::jsonb,      -- full result object
  image_hash    text,                           -- sha256 of original image (dedup)
  provider      text,                           -- claude / openrouter / mock
  created_at    timestamptz default now() not null
);

alter table public.color_analyses enable row level security;

drop policy if exists "Users can view own analyses"  on color_analyses;
drop policy if exists "Anyone can insert analysis"   on color_analyses;
drop policy if exists "Admins can view all analyses" on color_analyses;

create policy "Users can view own analyses"
  on color_analyses for select using (auth.uid() = user_id);
create policy "Anyone can insert analysis"
  on color_analyses for insert with check (true);
create policy "Admins can view all analyses"
  on color_analyses for select
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));


-- ─── 6. WAITLIST ────────────────────────────────────────────────────────────
create table if not exists public.waitlist (
  id          uuid default gen_random_uuid() primary key,
  email       text not null,
  name        text,
  phone       text,
  interest    text,                             -- service they're waiting for
  locale      text default 'fa',
  notified    bool default false,
  created_at  timestamptz default now() not null,
  constraint  waitlist_email_unique unique (email)
);

alter table public.waitlist enable row level security;

drop policy if exists "Anyone can join waitlist"    on waitlist;
drop policy if exists "Admins can manage waitlist"  on waitlist;

create policy "Anyone can join waitlist"
  on waitlist for insert with check (true);
create policy "Admins can manage waitlist"
  on waitlist for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));


-- ─── 7. ADMIN VIEW (helper) ─────────────────────────────────────────────────
create or replace view public.admin_bookings_view as
select
  b.id,
  b.status,
  b.service,
  b.full_name,
  b.email,
  b.phone,
  b.notes,
  b.meeting_link,
  b.created_at,
  ts.starts_at,
  ts.price_irr,
  p.status as payment_status,
  p.provider as payment_provider,
  p.paid_at
from public.bookings b
join public.time_slots ts on ts.id = b.slot_id
left join public.payments p on p.booking_id = b.id
order by ts.starts_at desc;

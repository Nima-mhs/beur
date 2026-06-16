-- =============================================
-- BEUR SEASON — Supabase Database Schema
-- Run this in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/zpxnyrqoeyjqcgzxnmry/sql
-- =============================================

-- 1. Profiles (auto-created on signup)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  phone text,
  created_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"   on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- Trigger: create profile when user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Time Slots (admin-managed via Supabase dashboard)
create table if not exists public.time_slots (
  id uuid default gen_random_uuid() primary key,
  starts_at timestamptz not null,
  duration_min int default 60 not null,
  available bool default true not null,
  price_irr int default 5000000, -- 500,000 Tomans in Rials
  created_at timestamptz default now() not null
);

alter table public.time_slots enable row level security;

-- Everyone can view available slots
create policy "Anyone can view available slots"
  on time_slots for select using (available = true);

-- Sample slots (edit dates as needed)
-- insert into public.time_slots (starts_at) values
--   ('2026-07-01 10:00:00+03:30'),
--   ('2026-07-01 14:00:00+03:30'),
--   ('2026-07-03 11:00:00+03:30');

-- 3. Bookings
create table if not exists public.bookings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  slot_id uuid references public.time_slots(id) not null,
  service text default 'personal_color_consultation' not null,
  status text default 'pending_payment' not null
    check (status in ('pending', 'pending_payment', 'confirmed', 'cancelled')),
  payment_method text,
  full_name text not null,
  email text not null,
  phone text,
  notes text,
  created_at timestamptz default now() not null
);

alter table public.bookings enable row level security;

create policy "Users can view own bookings"   on bookings for select using (auth.uid() = user_id);
create policy "Users can insert own bookings" on bookings for insert with check (auth.uid() = user_id);
create policy "Users can update own bookings" on bookings for update using (auth.uid() = user_id);

-- Trigger: mark slot unavailable when booking is created
create or replace function mark_slot_booked()
returns trigger as $$
begin
  if NEW.status != 'cancelled' then
    update public.time_slots set available = false where id = NEW.slot_id;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_booking_created on public.bookings;
create trigger on_booking_created
  after insert on public.bookings
  for each row execute function mark_slot_booked();

-- Trigger: re-enable slot when booking is cancelled
create or replace function mark_slot_available_on_cancel()
returns trigger as $$
begin
  if NEW.status = 'cancelled' and OLD.status != 'cancelled' then
    update public.time_slots set available = true where id = NEW.slot_id;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_booking_cancelled on public.bookings;
create trigger on_booking_cancelled
  after update on public.bookings
  for each row execute function mark_slot_available_on_cancel();

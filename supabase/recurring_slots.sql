-- Recurring weekly availability templates.
-- Admin defines rules like "every Monday at 10:00", then generates actual
-- time_slots rows for upcoming weeks from those rules via the admin panel.

create table if not exists public.recurring_slot_templates (
  id           uuid default gen_random_uuid() primary key,
  day_of_week  int not null check (day_of_week between 0 and 6), -- 0=Sunday .. 6=Saturday (JS Date convention)
  time_of_day  text not null,                                     -- "HH:MM", Tehran local time
  duration_min int default 60 not null,
  price_irr    int default 5000000,
  service      text default 'personal_color_consultation',
  active       bool default true not null,
  created_at   timestamptz default now() not null
);

alter table public.recurring_slot_templates enable row level security;

drop policy if exists "Admins can manage recurring templates" on recurring_slot_templates;

create policy "Admins can manage recurring templates"
  on recurring_slot_templates for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

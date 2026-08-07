-- ─── PAYMENT SETTINGS (singleton row) ────────────────────────────────────────
-- Editable from admin panel: consultation price/duration + bank transfer (IRR)
-- and Visa (international) payment details shown on the booking page.
-- No fabricated defaults for card numbers/USD price — admin must fill these in.

create table if not exists public.payment_settings (
  id                        int primary key default 1,
  consultation_duration_min int not null default 60,
  consultation_price_irr    bigint not null default 5000000,
  consultation_price_usd    numeric,
  irr_bank_name             text,
  irr_card_number           text,
  irr_account_holder        text,
  intl_card_brand           text default 'Visa',
  intl_card_number          text,
  intl_account_holder       text,
  updated_at                timestamptz default now(),
  constraint payment_settings_singleton check (id = 1)
);

alter table public.payment_settings enable row level security;

drop policy if exists "Anyone can view payment settings" on payment_settings;
drop policy if exists "Admins can manage payment settings" on payment_settings;

-- Public read: this info is shown to any visitor reaching the booking payment step.
create policy "Anyone can view payment settings"
  on payment_settings for select using (true);

create policy "Admins can manage payment settings"
  on payment_settings for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists payment_settings_updated_at on payment_settings;
create trigger payment_settings_updated_at
  before update on payment_settings
  for each row execute function public.set_updated_at();

insert into public.payment_settings (id) values (1) on conflict (id) do nothing;

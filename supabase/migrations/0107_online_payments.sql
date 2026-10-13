-- Online payments (Saudi Arabia first: cards incl. mada, Apple Pay, saved cards) through Moyasar.
--  * payment_sessions: one row per online checkout. It holds what the shopper chose (address, delivery time, offer code) and the
--    amount to pay. The order is only created once the money is confirmed by the payment provider, so a supplier is never
--    asked to prepare an order nobody paid for. If the order cannot be created after payment (for example the last item just
--    sold out) the payment is refunded straight away.
--  * saved_cards: the shopper's saved cards, Amazon style. Only the provider's token and the harmless details to recognise the
--    card (brand, last four digits, expiry, name) are kept; card numbers and security codes are never stored here.
-- Safe to run more than once.

create table if not exists payment_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id() references tenants(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'moyasar',
  method text not null default 'card',
  input jsonb not null,
  amount numeric(10, 2) not null check (amount > 0),
  currency text not null default 'SAR',
  save_card boolean not null default false,
  provider_payment_id text,
  status text not null default 'created' check (status in ('created', 'initiated', 'paid', 'placing', 'placed', 'failed', 'refunded', 'expired')),
  error text,
  order_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payment_sessions_user_idx on payment_sessions (user_id, created_at desc);
create unique index if not exists payment_sessions_provider_payment_idx on payment_sessions (provider_payment_id) where provider_payment_id is not null;
alter table payment_sessions enable row level security;
drop policy if exists tenant_fence on payment_sessions;
create policy tenant_fence on payment_sessions as restrictive for all
  using (tenant_id = (select current_tenant_id()) or (select is_super_admin()))
  with check (tenant_id = (select current_tenant_id()) or (select is_super_admin()));
drop policy if exists "own payment sessions" on payment_sessions;
create policy "own payment sessions" on payment_sessions for select using (user_id = (select auth.uid()));
drop policy if exists "start own payment session" on payment_sessions;
create policy "start own payment session" on payment_sessions for insert with check (user_id = (select auth.uid()) and status = 'created');
-- Status changes are made by the server (service role) only, after checking with the provider.

create table if not exists saved_cards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id() references tenants(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'moyasar',
  token text not null,
  brand text not null,
  last4 text not null check (last4 ~ '^[0-9]{4}$'),
  exp_month int check (exp_month between 1 and 12),
  exp_year int check (exp_year between 2000 and 2100),
  holder_name text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, token)
);
create index if not exists saved_cards_user_idx on saved_cards (user_id);
alter table saved_cards enable row level security;
drop policy if exists tenant_fence on saved_cards;
create policy tenant_fence on saved_cards as restrictive for all
  using (tenant_id = (select current_tenant_id()) or (select is_super_admin()))
  with check (tenant_id = (select current_tenant_id()) or (select is_super_admin()));
drop policy if exists "own saved cards" on saved_cards;
create policy "own saved cards" on saved_cards for select using (user_id = (select auth.uid()));
drop policy if exists "remove own saved card" on saved_cards;
create policy "remove own saved card" on saved_cards for delete using (user_id = (select auth.uid()));
drop policy if exists "update own saved card" on saved_cards;
create policy "update own saved card" on saved_cards for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- Cards are added by the server (service role) after a confirmed payment; the token is never sent to the browser:
-- the app reads only the columns below.
revoke select on saved_cards from anon, authenticated;
grant select (id, tenant_id, user_id, provider, brand, last4, exp_month, exp_year, holder_name, is_default, created_at) on saved_cards to authenticated;

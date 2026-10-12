-- API keys for suppliers: a supplier's own system (or a script) calls the FasTrack supplier API with a key tied to their one store.
-- Only a SHA-256 hash of the key is stored; the key itself is shown once when it is created. The API runs server-side with the
-- service role and scopes every query to the key's store, so a key can never reach another supplier's data.
-- Safe to run more than once.

create table if not exists supplier_api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  key_prefix text not null,
  key_hash text not null unique,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists supplier_api_keys_store_idx on supplier_api_keys (store_id, created_at desc);

alter table supplier_api_keys enable row level security;
drop policy if exists tenant_fence on supplier_api_keys;
create policy tenant_fence on supplier_api_keys as restrictive for all
  using (tenant_id = (select current_tenant_id()) or (select is_super_admin()))
  with check (tenant_id = (select current_tenant_id()) or (select is_super_admin()));

-- A supplier sees, creates and revokes the keys of their own store. The hash never needs to be read by the page.
drop policy if exists "supplier reads own keys" on supplier_api_keys;
create policy "supplier reads own keys" on supplier_api_keys for select
  using (exists (select 1 from stores s where s.id = store_id and s.owner_id = (select auth.uid())) or (select is_admin()));
drop policy if exists "supplier creates own keys" on supplier_api_keys;
create policy "supplier creates own keys" on supplier_api_keys for insert
  with check (exists (select 1 from stores s where s.id = store_id and s.owner_id = (select auth.uid()) and s.status::text = 'approved'));
drop policy if exists "supplier revokes own keys" on supplier_api_keys;
create policy "supplier revokes own keys" on supplier_api_keys for update
  using (exists (select 1 from stores s where s.id = store_id and s.owner_id = (select auth.uid())))
  with check (exists (select 1 from stores s where s.id = store_id and s.owner_id = (select auth.uid())));

-- Per-key call counter for a simple rate limit (calls per minute), kept in the database because the API runs on stateless workers.
create table if not exists supplier_api_hits (
  key_id uuid not null references supplier_api_keys(id) on delete cascade,
  minute timestamptz not null,
  calls int not null default 0,
  primary key (key_id, minute)
);
alter table supplier_api_hits enable row level security;
-- no policies: only the service role (the API) touches it

create or replace function supplier_api_hit(p_key uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into supplier_api_hits (key_id, minute, calls) values (p_key, date_trunc('minute', now()), 1)
  on conflict (key_id, minute) do update set calls = supplier_api_hits.calls + 1
  returning calls into n;
  delete from supplier_api_hits where minute < now() - interval '1 hour' and key_id = p_key;
  return n;
end $$;
revoke all on function supplier_api_hit(uuid) from public, anon, authenticated;

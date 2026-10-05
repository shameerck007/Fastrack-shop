-- DRAFT — NOT APPLIED. Review first; test on a Supabase branch before running on production.
--
-- Multi-tenant foundation for FasTrack Shop (Saudi tenant + India tenant).
--
-- Design (one Supabase project, shared tables, row-level isolation):
--   * Every business row carries tenant_id.
--   * RESTRICTIVE row-level-security policies are added on top of the existing
--     (permissive) policies. Postgres ANDs restrictive policies with the permissive
--     ones, so every existing policy keeps working and is additionally fenced by
--     tenant — the ~100 existing policies are not rewritten.
--   * Who is in which tenant:
--       - staff (admin / merchant / rider / store_staff) are pinned to profiles.tenant_id;
--         they can never switch tenant;
--       - shoppers and anonymous visitors use the market they picked, sent by the app as
--         the `x-tenant-id` request header; with no header they get the default tenant;
--       - super_admin sees every tenant.
--   * "admin" now means TENANT admin. "super_admin" is the platform owner.
--   * Customers have one login; their data (addresses, cart, wishlist) is theirs, while
--     orders/payments/etc. carry the tenant of the shop they bought from.
--
-- Run STEP 0 on its own first (Postgres cannot use a new enum value in the same transaction).

-- ============================================================
-- STEP 0 (run alone)
-- ============================================================
alter type user_role add value if not exists 'super_admin';

-- ============================================================
-- STEP 1: countries and tenants
-- ============================================================
create table if not exists countries (
  code text primary key,                 -- ISO 3166-1 alpha-2
  name text not null,
  currency text not null,                -- ISO 4217
  currency_symbol text not null,
  dial_code text not null,
  tax_label text not null,               -- VAT / GST
  default_tax_rate numeric not null,     -- percent; real rates are per product (see products.tax_rate)
  locale text not null,
  is_active boolean not null default true
);

insert into countries (code, name, currency, currency_symbol, dial_code, tax_label, default_tax_rate, locale) values
  ('SA', 'Saudi Arabia', 'SAR', 'SAR', '+966', 'VAT', 15, 'en-SA'),
  ('IN', 'India',        'INR', '₹',   '+91',  'GST', 5,  'en-IN')
on conflict (code) do nothing;

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  country_code text not null references countries(code),
  currency text not null,
  logo_url text,
  status text not null default 'active' check (status in ('draft', 'active', 'suspended')),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
-- exactly one default tenant (used when a visitor has not chosen a market)
create unique index if not exists tenants_one_default on tenants (is_default) where is_default;

insert into tenants (id, slug, name, country_code, currency, is_default, status) values
  ('00000000-0000-0000-0000-0000000000a1', 'fastrack-sa', 'FasTrack Saudi Arabia', 'SA', 'SAR', true,  'active'),
  ('00000000-0000-0000-0000-0000000000a2', 'fastrack-in', 'FasTrack India',        'IN', 'INR', false, 'draft')
on conflict (id) do nothing;

alter table countries enable row level security;
alter table tenants enable row level security;
create policy "countries are public" on countries for select using (true);
create policy "active tenants are public" on tenants for select using (status = 'active' or is_super_admin());

-- ============================================================
-- STEP 2: helpers
-- ============================================================
create or replace function is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'super_admin');
$$;

-- profiles.tenant_id is added below; the function body is resolved at call time.
alter table profiles add column if not exists tenant_id uuid references tenants(id);
update profiles set tenant_id = '00000000-0000-0000-0000-0000000000a1' where tenant_id is null;
alter table profiles alter column tenant_id set default '00000000-0000-0000-0000-0000000000a1';

create or replace function current_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    -- staff are pinned to their own tenant and cannot choose another
    (select p.tenant_id from profiles p where p.id = auth.uid() and p.role in ('admin', 'merchant', 'rider', 'store_staff')),
    -- shoppers / visitors: the market they picked (header set by the app), if it is a real active tenant
    (select t.id from tenants t
      where t.status = 'active'
        and t.id::text = nullif(current_setting('request.headers', true)::json ->> 'x-tenant-id', '')),
    (select t.id from tenants t where t.is_default limit 1)
  );
$$;

-- Does the signed-in user own this order? (used so customers keep seeing their own orders)
create or replace function owns_order(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from orders o where o.id = target and o.user_id = auth.uid());
$$;

-- ============================================================
-- STEP 3: tenant_id on business tables (existing rows -> Saudi tenant)
-- ============================================================
do $$
declare
  t text;
  tables text[] := array[
    'stores', 'warehouses', 'warehouse_staff', 'categories', 'products', 'product_variants', 'inventory', 'promotions',
    'orders', 'order_items', 'order_status_history', 'order_messages', 'order_ratings', 'payments', 'refunds', 'reviews',
    'delivery_partners', 'delivery_assignments', 'rider_settlement_entries', 'settlement_payouts', 'company_settings'
  ];
begin
  foreach t in array tables loop
    execute format('alter table %I add column if not exists tenant_id uuid references tenants(id)', t);
    execute format('update %I set tenant_id = %L where tenant_id is null', t, '00000000-0000-0000-0000-0000000000a1');
    -- new rows inherit the tenant of whoever inserts them
    execute format('alter table %I alter column tenant_id set default current_tenant_id()', t);
    execute format('alter table %I alter column tenant_id set not null', t);
    execute format('create index if not exists %I on %I (tenant_id)', t || '_tenant_idx', t);
  end loop;
end $$;

-- one business-settings row per tenant (was a single fixed row)
create unique index if not exists company_settings_tenant_uidx on company_settings (tenant_id);
insert into company_settings (id, tenant_id, trading_name)
values (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a2', 'FasTrack India')
on conflict do nothing;

-- Money / tax context on every order (so reports and invoices stay correct per country)
alter table orders add column if not exists currency text not null default 'SAR';
alter table orders add column if not exists country_code text not null default 'SA' references countries(code);
alter table orders add column if not exists tax_label text not null default 'VAT';
-- Tax per product (India GST is 0 / 5 / 12 / 18 % by item). Null = the country default.
alter table products add column if not exists tax_rate numeric check (tax_rate is null or (tax_rate >= 0 and tax_rate <= 100));
alter table products add column if not exists hsn_code text;

-- ============================================================
-- STEP 4: restrictive tenant fences
-- ============================================================
-- Catalog and operations tables: only the current tenant's rows (super_admin sees all).
do $$
declare
  t text;
  fenced text[] := array[
    'stores', 'warehouses', 'warehouse_staff', 'categories', 'products', 'product_variants', 'inventory', 'promotions',
    'delivery_partners', 'delivery_assignments', 'rider_settlement_entries', 'settlement_payouts', 'company_settings'
  ];
begin
  foreach t in array fenced loop
    execute format('drop policy if exists tenant_fence on %I', t);
    execute format(
      'create policy tenant_fence on %I as restrictive for all using (tenant_id = current_tenant_id() or is_super_admin()) with check (tenant_id = current_tenant_id() or is_super_admin())',
      t
    );
  end loop;
end $$;

-- Orders and things hanging off orders: the tenant's staff see their tenant's orders; a
-- customer keeps seeing their own orders whichever market they are browsing.
drop policy if exists tenant_fence on orders;
create policy tenant_fence on orders as restrictive for all
  using (tenant_id = current_tenant_id() or user_id = auth.uid() or is_super_admin())
  with check (tenant_id = current_tenant_id() or user_id = auth.uid() or is_super_admin());

do $$
declare
  t text;
  order_children text[] := array['order_items', 'order_status_history', 'order_messages', 'order_ratings', 'payments', 'refunds', 'reviews'];
begin
  foreach t in array order_children loop
    execute format('drop policy if exists tenant_fence on %I', t);
    execute format(
      'create policy tenant_fence on %I as restrictive for all using (tenant_id = current_tenant_id() or is_super_admin() or (order_id is not null and owns_order(order_id))) with check (tenant_id = current_tenant_id() or is_super_admin() or (order_id is not null and owns_order(order_id)))',
      t
    );
  end loop;
end $$;

-- Profiles: a tenant admin only sees people registered in their own tenant (plus themselves).
drop policy if exists tenant_fence on profiles;
create policy tenant_fence on profiles as restrictive for select
  using (id = auth.uid() or tenant_id = current_tenant_id() or is_super_admin());

-- ============================================================
-- STEP 5: tenant-aware public RPCs
-- ============================================================
drop function if exists public_delivery_zones();
create function public_delivery_zones()
returns table (
  store_id uuid, lat double precision, lng double precision, radius_km numeric,
  standard_enabled boolean, standard_radius_km numeric, standard_days int
)
language sql security definer set search_path = public stable as $$
  select s.id, w.lat, w.lng, w.delivery_radius_km, w.standard_delivery_enabled, w.standard_radius_km, w.standard_delivery_days
  from stores s join warehouses w on w.id = s.warehouse_id
  where s.status = 'approved' and w.is_active and s.tenant_id = current_tenant_id()
  union all
  select null::uuid, w.lat, w.lng, w.delivery_radius_km, w.standard_delivery_enabled, w.standard_radius_km, w.standard_delivery_days
  from warehouses w
  where w.is_active and w.tenant_id = current_tenant_id()
    and not exists (select 1 from stores s2 where s2.warehouse_id = w.id);
$$;
grant execute on function public_delivery_zones() to anon, authenticated;

-- Still to do in later migrations: tenant checks inside the other SECURITY DEFINER functions
-- (settlement summaries, store/warehouse lookups, default_warehouse_id), per-tenant payment
-- configuration, plans/subscriptions, and the audit log.

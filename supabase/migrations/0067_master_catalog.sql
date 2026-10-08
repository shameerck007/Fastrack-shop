-- Master catalog: FasTrack owns the product definitions (name, brand, photo, category, barcode, tax code, pack sizes) and
-- suppliers add OFFERS to them (their own price and stock). One catalog per market (tenant).
-- A supplier's offer is still an ordinary products row (so the shop, cart and orders do not change); products.master_id links
-- it to the master product, and the shared details (name, brand, photo, category, tax) are kept in step with the master.
-- Suppliers can request a product that is not in the catalog; it is reviewed before it appears for anyone.
-- Run the whole file in the Supabase SQL editor. No blank lines inside function bodies.

create table if not exists master_products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id() references tenants(id),
  name text not null,
  name_ar text,
  brand text,
  brand_ar text,
  description text,
  description_ar text,
  category_id uuid references categories(id) on delete set null,
  image_url text,
  barcode text,
  hsn_code text,
  tax_rate numeric check (tax_rate is null or (tax_rate >= 0 and tax_rate <= 100)),
  status text not null default 'approved' check (status in ('approved', 'pending', 'rejected')),
  requested_by_store uuid references stores(id) on delete set null,
  rejection_reason text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists master_products_tenant_idx on master_products (tenant_id, status);
create index if not exists master_products_category_idx on master_products (category_id);
create index if not exists master_products_name_trgm_idx on master_products using gin (name gin_trgm_ops);
create unique index if not exists master_products_barcode_uidx on master_products (tenant_id, barcode) where barcode is not null and status <> 'rejected';

create table if not exists master_variants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id() references tenants(id),
  master_id uuid not null references master_products(id) on delete cascade,
  label text not null,
  label_ar text,
  unit text not null default 'unit',
  quantity numeric(10, 3) not null default 1,
  barcode text,
  is_default boolean not null default false,
  sort_order int not null default 0
);
create index if not exists master_variants_master_idx on master_variants (master_id);

alter table products add column if not exists master_id uuid references master_products(id) on delete set null;
alter table product_variants add column if not exists master_variant_id uuid references master_variants(id) on delete set null;
create index if not exists products_master_idx on products (master_id);
-- A supplier can sell a master product once.
create unique index if not exists products_store_master_uidx on products (store_id, master_id) where store_id is not null and master_id is not null;

alter table master_products enable row level security;
alter table master_variants enable row level security;

drop policy if exists "approved catalog is readable" on master_products;
create policy "approved catalog is readable" on master_products for select using (
  is_admin()
  or status = 'approved'
  or exists (select 1 from stores s where s.id = master_products.requested_by_store and s.owner_id = auth.uid())
);
drop policy if exists "admins manage catalog" on master_products;
create policy "admins manage catalog" on master_products for all using (is_admin()) with check (is_admin());
drop policy if exists "suppliers request products" on master_products;
create policy "suppliers request products" on master_products for insert with check (
  status = 'pending'
  and exists (select 1 from stores s where s.id = master_products.requested_by_store and s.owner_id = auth.uid() and s.status = 'approved')
);
drop policy if exists tenant_fence on master_products;
create policy tenant_fence on master_products as restrictive for all using (tenant_id = current_tenant_id() or is_super_admin()) with check (tenant_id = current_tenant_id() or is_super_admin());

drop policy if exists "catalog variants are readable" on master_variants;
create policy "catalog variants are readable" on master_variants for select using (
  exists (select 1 from master_products m where m.id = master_variants.master_id)
);
drop policy if exists "admins manage catalog variants" on master_variants;
create policy "admins manage catalog variants" on master_variants for all using (is_admin()) with check (is_admin());
drop policy if exists "suppliers add variants to their requests" on master_variants;
create policy "suppliers add variants to their requests" on master_variants for insert with check (
  exists (
    select 1 from master_products m join stores s on s.id = m.requested_by_store
    where m.id = master_variants.master_id and m.status = 'pending' and s.owner_id = auth.uid()
  )
);
drop policy if exists tenant_fence on master_variants;
create policy tenant_fence on master_variants as restrictive for all using (tenant_id = current_tenant_id() or is_super_admin()) with check (tenant_id = current_tenant_id() or is_super_admin());

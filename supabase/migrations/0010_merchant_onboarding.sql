-- Merchant onboarding: any authenticated user can apply to open a store;
-- an admin reviews and approves/rejects. Approval (a separate server
-- action) promotes the owner's profile.role to 'merchant' and creates a
-- warehouse for their store so existing inventory/rider-pickup plumbing
-- works unchanged for merchant-owned products.
--
-- Scope: onboarding + a merchant's own product/inventory dashboard only.
-- Multi-seller product comparison, commission/settlement, and splitting a
-- cart across sellers are NOT built here — deferred, same as the rest of
-- Phase 2/3 in the original BRD.

create type store_status as enum ('pending', 'approved', 'rejected', 'suspended');

create table stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  cr_number text not null,
  vat_number text,
  bank_name text,
  bank_iban text,
  contact_phone text,
  address_line text,
  city text not null default 'Riyadh',
  status store_status not null default 'pending',
  rejection_reason text,
  warehouse_id uuid references warehouses(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id)
);

create trigger stores_set_updated_at before update on stores
  for each row execute function set_updated_at();

alter table products add column store_id uuid references stores(id) on delete cascade;

alter table stores enable row level security;

-- A user can apply once (unique owner_id) and only ever insert their own
-- application starting in 'pending' status — they can't self-approve.
create policy "users apply for own store" on stores for insert with check (
  owner_id = auth.uid() and status = 'pending'
);
create policy "owners and admins read own store" on stores for select using (
  owner_id = auth.uid() or is_admin()
);
-- Once approved/rejected, only admin can change it further (e.g. suspend) —
-- editing your own listing after approval isn't in scope for this pass.
create policy "owners update own pending store" on stores for update using (
  owner_id = auth.uid() and status = 'pending'
) with check (
  owner_id = auth.uid() and status = 'pending'
);
create policy "admins manage stores" on stores for all using (is_admin()) with check (is_admin());

-- Merchants manage products/variants/inventory scoped to their own
-- approved store. Public read of products/variants/inventory is already
-- covered by existing policies (they don't discriminate by store_id).
create policy "merchants manage own products" on products for all using (
  exists (select 1 from stores s where s.id = products.store_id and s.owner_id = auth.uid() and s.status = 'approved')
) with check (
  exists (select 1 from stores s where s.id = products.store_id and s.owner_id = auth.uid() and s.status = 'approved')
);

create policy "merchants manage own variants" on product_variants for all using (
  exists (
    select 1 from products p join stores s on s.id = p.store_id
    where p.id = product_variants.product_id and s.owner_id = auth.uid() and s.status = 'approved'
  )
) with check (
  exists (
    select 1 from products p join stores s on s.id = p.store_id
    where p.id = product_variants.product_id and s.owner_id = auth.uid() and s.status = 'approved'
  )
);

create policy "merchants manage own inventory" on inventory for all using (
  exists (
    select 1 from product_variants v
    join products p on p.id = v.product_id
    join stores s on s.id = p.store_id
    where v.id = inventory.variant_id and s.owner_id = auth.uid() and s.status = 'approved'
  )
) with check (
  exists (
    select 1 from product_variants v
    join products p on p.id = v.product_id
    join stores s on s.id = p.store_id
    where v.id = inventory.variant_id and s.owner_id = auth.uid() and s.status = 'approved'
  )
);

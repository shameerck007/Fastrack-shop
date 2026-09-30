-- "Store Staff" accounts for FasTrack's own warehouse locations — the same
-- shape as merchant accounts (own portal, receive orders, advance them
-- through preparing -> ready for pickup), but scoped to ONE warehouse
-- rather than owning a `stores` row, because FasTrack's own product catalog
-- is shared across every FasTrack location (multi-location routing, see
-- 0030) — a location's staff manages that location's STOCK and ORDERS, not
-- the shared product listings (name/price/photos), which stay admin-only so
-- one location can't silently change what every other location sells.

alter type user_role add value 'store_staff';

create table warehouse_staff (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references warehouses(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id) -- one warehouse per staff account, same shape as stores.owner_id being unique
);

alter table warehouse_staff enable row level security;

create policy "staff read own assignment" on warehouse_staff for select using (
  user_id = auth.uid() or is_admin()
);
create policy "admins manage warehouse staff" on warehouse_staff for all using (is_admin()) with check (is_admin());

-- SECURITY DEFINER for the same reason as is_assigned_rider/order_has_my_store_item:
-- this queries warehouse_staff directly inside policies on other tables, so
-- an inline subquery would make Postgres evaluate warehouse_staff's own RLS
-- while evaluating theirs, recursing (42P17).
create or replace function my_staff_warehouse_id()
returns uuid as $$
  select warehouse_id from warehouse_staff where user_id = auth.uid() limit 1;
$$ language sql stable security definer set search_path = public;

create policy "warehouse staff view their warehouse orders" on orders for select using (
  warehouse_id = my_staff_warehouse_id()
);

-- Same one-step-at-a-time shape as the merchant policies (0026/0027):
-- pending -> confirmed -> preparing -> ready_for_pickup only, nothing else
-- (never rider_assigned/out_for_delivery/delivered/cancelled).
create policy "warehouse staff advance their orders" on orders for update using (
  warehouse_id = my_staff_warehouse_id() and status in ('pending', 'confirmed', 'preparing')
) with check (
  warehouse_id = my_staff_warehouse_id() and status in ('confirmed', 'preparing', 'ready_for_pickup')
);

-- Unlike merchant order_items visibility (scoped per-product-owner, since a
-- marketplace order can mix sellers), a FasTrack-fulfilled order only ever
-- has FasTrack's own items in it — staff see the whole order's items.
create policy "warehouse staff view their warehouse order items" on order_items for select using (
  exists (select 1 from orders o where o.id = order_items.order_id and o.warehouse_id = my_staff_warehouse_id())
);

create policy "warehouse staff view their warehouse order history" on order_status_history for select using (
  exists (select 1 from orders o where o.id = order_status_history.order_id and o.warehouse_id = my_staff_warehouse_id())
);
create policy "warehouse staff log their order status changes" on order_status_history for insert with check (
  exists (select 1 from orders o where o.id = order_status_history.order_id and o.warehouse_id = my_staff_warehouse_id())
  and status in ('confirmed', 'preparing', 'ready_for_pickup')
);

-- Stock only — no product/variant edit policy, by design (see comment above).
create policy "warehouse staff update their warehouse stock" on inventory for update using (
  warehouse_id = my_staff_warehouse_id()
) with check (
  warehouse_id = my_staff_warehouse_id()
);

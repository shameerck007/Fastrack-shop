-- Support a real rider workflow (self-serve accept, like a delivery-partner
-- app) instead of admin-only SQL assignment, and fix RLS gaps found while
-- building it:
--   1. "admins update orders" let ANY rider update ANY order to ANY status
--      (not scoped to their own assignment) - tightened.
--   2. "admins manage order history" had the same gap - tightened.
--   3. Riders had no SELECT policy for the pool of unassigned ready orders,
--      so there was no way to browse/accept work.
--   4. Riders had no SELECT policy on `addresses` at all, so a customer's
--      delivery address silently came back null on every rider order page.
--   5. `warehouses` never had RLS enabled in 0001, leaving it fully open.
--
-- Note: 0001_init.sql has already been updated in place with the fixed
-- policies for anyone applying the schema fresh. This migration exists to
-- bring an already-migrated database (this project) up to date the same way.

-- --- 1 & 2: scope rider order/history updates to their own assignment ---
drop policy "admins update orders" on orders;
create policy "admins and assigned riders update orders" on orders for update using (
  is_admin() or (is_rider() and is_assigned_rider(id))
);

drop policy "admins manage order history" on order_status_history;
create policy "admins and assigned riders manage order history" on order_status_history for all using (
  is_admin() or (is_rider() and is_assigned_rider(order_id))
) with check (
  is_admin() or (is_rider() and is_assigned_rider(order_id))
);

-- --- 3: let online riders see (and accept) the unassigned ready-order pool ---
create policy "riders view available order pool" on orders for select using (
  is_rider() and status in ('preparing', 'ready_for_pickup')
  and not exists (select 1 from delivery_assignments da where da.order_id = orders.id)
);

create policy "riders view available pool items" on order_items for select using (
  exists (
    select 1 from orders o
    where o.id = order_id
      and is_rider()
      and o.status in ('preparing', 'ready_for_pickup')
      and not exists (select 1 from delivery_assignments da where da.order_id = o.id)
  )
);

create policy "riders accept available orders" on delivery_assignments for insert with check (
  rider_id = auth.uid()
  and exists (
    select 1 from orders o where o.id = order_id and o.status in ('preparing', 'ready_for_pickup')
  )
);

-- --- 4: assigned riders (and the order's owner/admin, already covered) can
-- read the delivery address for orders assigned to them ---
create policy "assigned riders read delivery address" on addresses for select using (
  exists (
    select 1 from orders o
    where o.address_id = addresses.id and is_assigned_rider(o.id)
  )
);

-- --- 5: warehouses never had RLS enabled ---
alter table warehouses enable row level security;
create policy "warehouses are publicly readable" on warehouses for select using (true);
create policy "admins manage warehouses" on warehouses for all using (is_admin()) with check (is_admin());

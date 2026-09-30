-- Fix infinite recursion (42P17) between orders and delivery_assignments RLS
-- policies: each referenced the other via inline EXISTS subqueries, which
-- forces Postgres to evaluate each table's RLS while evaluating the other's.
-- Replace with SECURITY DEFINER helper functions that bypass RLS internally.
--
-- Note: 0001_init.sql has already been updated in place with the fixed
-- policies for anyone applying the schema fresh. This migration exists to
-- bring an already-migrated database (this project) up to date the same way.

create or replace function is_assigned_rider(target_order_id uuid)
returns boolean as $$
  select exists (
    select 1 from delivery_assignments
    where order_id = target_order_id and rider_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

create or replace function is_order_owner(target_order_id uuid)
returns boolean as $$
  select exists (
    select 1 from orders where id = target_order_id and user_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

drop policy "users read own orders" on orders;
create policy "users read own orders" on orders for select using (
  auth.uid() = user_id or is_admin() or is_assigned_rider(id)
);

drop policy "users read own order items" on order_items;
create policy "users read own order items" on order_items for select using (
  exists (
    select 1 from orders o where o.id = order_id and o.user_id = auth.uid()
  ) or is_admin() or is_assigned_rider(order_id)
);

drop policy "users read own order history" on order_status_history;
create policy "users read own order history" on order_status_history for select using (
  exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid())
  or is_admin() or is_assigned_rider(order_id)
);

drop policy "riders read own assignments" on delivery_assignments;
create policy "riders read own assignments" on delivery_assignments for select using (
  rider_id = auth.uid() or is_admin() or is_order_owner(order_id)
);

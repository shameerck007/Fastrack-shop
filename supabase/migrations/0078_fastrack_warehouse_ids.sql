-- Which warehouses are FasTrack's own: active warehouses that no supplier store points at, whatever that store's status is.
-- Shoppers cannot see stores that are still pending or suspended, so the app could not tell that such a store's warehouse was not FasTrack's,
-- and orders for FasTrack's own products could be sent to it. This lets the app ask the database directly.
-- Run the whole file in the Supabase SQL editor.

create or replace function fastrack_warehouse_ids()
returns setof uuid
language sql security definer set search_path = public stable as $$
  select w.id from warehouses w
  where w.is_active and w.tenant_id = current_tenant_id()
    and not exists (select 1 from stores s where s.warehouse_id = w.id);
$$;
grant execute on function fastrack_warehouse_ids() to anon, authenticated;

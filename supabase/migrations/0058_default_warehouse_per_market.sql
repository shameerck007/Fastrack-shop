-- default_warehouse_id() picked the oldest FasTrack warehouse of ANY country, so with several FasTrack
-- locations a visitor without a delivery location could be routed to another market's warehouse.
-- It now only considers the market being browsed. No blank lines inside the function.
create or replace function default_warehouse_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select w.id from warehouses w
  where w.is_active
    and w.tenant_id = current_tenant_id()
    and not exists (select 1 from stores s where s.warehouse_id = w.id)
  order by w.created_at
  limit 1;
$$;

-- 1) Custom Express delivery area: a shape drawn on the map (list of [lat, lng] points). When set, it replaces the
--    circle (delivery_radius_km) for Express; when empty the circle keeps working exactly as before.
alter table warehouses add column if not exists delivery_polygon jsonb;
-- 2) How far from the pickup a rider is offered orders, per market (set by that market's admin; default 20 km).
alter table company_settings add column if not exists rider_pickup_radius_km numeric not null default 20 check (rider_pickup_radius_km > 0 and rider_pickup_radius_km <= 200);
-- 3) The public zone list now also carries the shape. No blank lines inside the function.
drop function if exists public_delivery_zones();
create function public_delivery_zones()
returns table (
  store_id uuid, lat double precision, lng double precision, radius_km numeric,
  standard_enabled boolean, standard_radius_km numeric, standard_days int, polygon jsonb
)
language sql security definer set search_path = public stable as $$
  select s.id, w.lat, w.lng, w.delivery_radius_km, w.standard_delivery_enabled, w.standard_radius_km, w.standard_delivery_days, w.delivery_polygon
  from stores s join warehouses w on w.id = s.warehouse_id
  where s.status = 'approved' and w.is_active and s.tenant_id = current_tenant_id()
  union all
  select null::uuid, w.lat, w.lng, w.delivery_radius_km, w.standard_delivery_enabled, w.standard_radius_km, w.standard_delivery_days, w.delivery_polygon
  from warehouses w
  where w.is_active and w.tenant_id = current_tenant_id()
    and not exists (select 1 from stores s2 where s2.warehouse_id = w.id);
$$;
grant execute on function public_delivery_zones() to anon, authenticated;

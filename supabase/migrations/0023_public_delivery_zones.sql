-- Lets the browser evaluate "does this seller deliver to my location?" for
-- every product without a per-product round trip: one row per approved
-- store (its warehouse's centre + radius), plus one row with store_id NULL
-- for FasTrack's own products. Exposes only coordinates/radius, not the
-- private store details.
create or replace function public_delivery_zones()
returns table (store_id uuid, lat double precision, lng double precision, radius_km numeric)
language sql
security definer
set search_path = public
stable
as $$
  select s.id, w.lat, w.lng, w.delivery_radius_km
  from stores s join warehouses w on w.id = s.warehouse_id
  where s.status = 'approved' and w.is_active
  union all
  select null::uuid, w.lat, w.lng, w.delivery_radius_km
  from warehouses w where w.id = default_warehouse_id();
$$;
grant execute on function public_delivery_zones() to anon, authenticated;

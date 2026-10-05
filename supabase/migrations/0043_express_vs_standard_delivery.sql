-- Delivery radius no longer decides whether a product is visible.
--
--   * delivery_radius_km (existing column) now means the EXPRESS radius:
--     customers inside it can choose Express delivery.
--   * Standard delivery is a separate, broader service. By default it is on and
--     has no radius, so products stay visible and orderable outside the Express
--     radius. A radius can be set to limit it, or it can be switched off.
--   * standard_delivery_days is the estimated number of days for Standard.
--
-- A product is available to a customer when it is in stock AND at least one of
-- Express / Standard applies to their delivery location.

alter table warehouses
  add column if not exists standard_delivery_enabled boolean not null default true,
  add column if not exists standard_radius_km numeric(7, 2)
    check (standard_radius_km is null or standard_radius_km > 0),
  add column if not exists standard_delivery_days int not null default 2
    check (standard_delivery_days between 0 and 30);

comment on column warehouses.delivery_radius_km is
  'Express delivery radius (km). Customers inside it can choose Express. Null = Express is not limited by distance.';
comment on column warehouses.standard_radius_km is
  'Standard delivery radius (km). Null = no distance limit.';

-- Return type changes, so the function has to be dropped and recreated.
drop function if exists public_delivery_zones();
create function public_delivery_zones()
returns table (
  store_id uuid,
  lat double precision,
  lng double precision,
  radius_km numeric,
  standard_enabled boolean,
  standard_radius_km numeric,
  standard_days int
)
language sql
security definer
set search_path = public
stable
as $$
  select s.id, w.lat, w.lng, w.delivery_radius_km,
         w.standard_delivery_enabled, w.standard_radius_km, w.standard_delivery_days
  from stores s join warehouses w on w.id = s.warehouse_id
  where s.status = 'approved' and w.is_active
  union all
  select null::uuid, w.lat, w.lng, w.delivery_radius_km,
         w.standard_delivery_enabled, w.standard_radius_km, w.standard_delivery_days
  from warehouses w
  where w.is_active and not exists (select 1 from stores s2 where s2.warehouse_id = w.id);
$$;
grant execute on function public_delivery_zones() to anon, authenticated;

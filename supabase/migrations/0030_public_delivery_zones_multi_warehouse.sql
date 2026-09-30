-- public_delivery_zones() only ever emitted a single row for FasTrack's own
-- products, scoped to default_warehouse_id() — now that FasTrack can have
-- multiple own-warehouse locations (checkout already routes orders to
-- whichever one is nearest-and-covering), this browsing-time check was
-- stuck only ever looking at the original default warehouse's zone. A
-- customer outside that one zone but inside a newer location's zone would
-- have the whole storefront blocked, or see FasTrack's own products marked
-- undeliverable, despite checkout being able to actually fulfil their order.
--
-- Fix: one row per FasTrack-owned *active* warehouse (same "not exists a
-- store pointing at it" definition used everywhere else), not just the
-- default one — mirrors the one-row-per-merchant-store shape already used
-- below it.
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
  from warehouses w
  where w.is_active and not exists (select 1 from stores s2 where s2.warehouse_id = w.id);
$$;

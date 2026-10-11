-- Common delivery areas. Instead of drawing a delivery boundary for every shop and warehouse, the admin draws a few shared areas (a city
-- or part of a city) with their own rules. Each shop and warehouse then only needs its GPS pin: the system works out which area it sits in,
-- and for each order it checks the customer's area, the shop's area, the distance and the rules to decide Express or Standard.
-- While no area exists, nothing changes: the old per-shop boundaries keep working. Once one area exists, areas decide delivery.
-- Run the whole file in the Supabase SQL editor. No blank lines inside function bodies.

create table if not exists delivery_areas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id() references tenants(id),
  name text not null,
  name_ar text,
  -- The shape: a drawn polygon (list of [lat, lng]) or, when none, a circle around (lat, lng).
  polygon jsonb,
  lat double precision check (lat is null or lat between -90 and 90),
  lng double precision check (lng is null or lng between -180 and 180),
  radius_km numeric check (radius_km is null or (radius_km > 0 and radius_km <= 500)),
  -- Express: shops and customers in express-enabled areas can be served within this many km of the shop.
  express_enabled boolean not null default true,
  express_max_km numeric not null default 8 check (express_max_km > 0 and express_max_km <= 100),
  -- Standard: delivered in this many days, with no distance limit inside enabled areas.
  standard_enabled boolean not null default true,
  standard_days int not null default 2 check (standard_days between 0 and 30),
  -- Third-party logistics (planned): only recorded for now.
  logistics_enabled boolean not null default false,
  -- When areas overlap, the higher number wins.
  priority int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (polygon is not null or (lat is not null and lng is not null and radius_km is not null))
);
create index if not exists delivery_areas_tenant_idx on delivery_areas (tenant_id, is_active);

alter table delivery_areas enable row level security;
drop policy if exists tenant_fence on delivery_areas;
create policy tenant_fence on delivery_areas as restrictive for all
  using (tenant_id = (select current_tenant_id()) or (select is_super_admin()))
  with check (tenant_id = (select current_tenant_id()) or (select is_super_admin()));
drop policy if exists "admins manage delivery areas" on delivery_areas;
create policy "admins manage delivery areas" on delivery_areas for all
  using ((select is_admin()))
  with check ((select is_admin()));

-- Per-shop exceptions to the area rules: switch Express off for one shop, or give it a shorter maximum distance.
alter table warehouses add column if not exists express_mode text not null default 'auto' check (express_mode in ('auto', 'off'));
alter table warehouses add column if not exists express_max_km numeric check (express_max_km is null or (express_max_km > 0 and express_max_km <= 100));

create or replace function public_delivery_areas()
returns table (
  id uuid, name text, name_ar text, polygon jsonb, lat double precision, lng double precision, radius_km numeric,
  express_enabled boolean, express_max_km numeric, standard_enabled boolean, standard_days int, logistics_enabled boolean, priority int
)
language sql security definer set search_path = public stable as $$
  select a.id, a.name, a.name_ar, a.polygon, a.lat, a.lng, a.radius_km, a.express_enabled, a.express_max_km, a.standard_enabled, a.standard_days, a.logistics_enabled, a.priority
  from delivery_areas a
  where a.is_active and a.tenant_id = current_tenant_id();
$$;
grant execute on function public_delivery_areas() to anon, authenticated;

-- The public zone list now also carries each warehouse's exception settings.
drop function if exists public_delivery_zones();
create function public_delivery_zones()
returns table (
  store_id uuid, lat double precision, lng double precision, radius_km numeric,
  standard_enabled boolean, standard_radius_km numeric, standard_days int, polygon jsonb,
  express_mode text, express_max_km numeric
)
language sql security definer set search_path = public stable as $$
  select s.id, w.lat, w.lng, w.delivery_radius_km, w.standard_delivery_enabled, w.standard_radius_km, w.standard_delivery_days, w.delivery_polygon, w.express_mode, w.express_max_km
  from stores s join warehouses w on w.id = s.warehouse_id
  where s.status = 'approved' and w.is_active and s.tenant_id = current_tenant_id()
  union all
  select null::uuid, w.lat, w.lng, w.delivery_radius_km, w.standard_delivery_enabled, w.standard_radius_km, w.standard_delivery_days, w.delivery_polygon, w.express_mode, w.express_max_km
  from warehouses w
  where w.is_active and w.tenant_id = current_tenant_id()
    and not exists (select 1 from stores s2 where s2.warehouse_id = w.id);
$$;
grant execute on function public_delivery_zones() to anon, authenticated;

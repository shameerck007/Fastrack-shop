-- Quick (Express) delivery: automatic rider offers.
-- When an Express order is being prepared or is ready, the nearest free rider inside the Express rider radius gets a
-- short-lived offer (default 30 s). Declined or expired offers move to the next nearest rider, the radius widening a
-- little each time up to the general rider pickup radius. Nobody can take an Express order without an offer.
-- Run the whole file in the Supabase SQL editor. No blank lines are used inside function bodies.

-- 1) Settings, per market (Admin > Business settings)
alter table company_settings add column if not exists express_auto_dispatch boolean not null default true;
alter table company_settings add column if not exists express_rider_radius_km numeric not null default 5 check (express_rider_radius_km > 0 and express_rider_radius_km <= 200);
alter table company_settings add column if not exists express_offer_seconds int not null default 30 check (express_offer_seconds between 10 and 300);

-- 2) Offers
create table if not exists delivery_offers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id() references tenants(id),
  order_id uuid not null references orders(id) on delete cascade,
  rider_id uuid not null references delivery_partners(id) on delete cascade,
  status text not null default 'offered' check (status in ('offered', 'accepted', 'declined', 'expired')),
  distance_km numeric,
  offered_at timestamptz not null default now(),
  expires_at timestamptz not null,
  responded_at timestamptz,
  unique (order_id, rider_id)
);
create index if not exists delivery_offers_rider_idx on delivery_offers (rider_id, status);
create index if not exists delivery_offers_order_idx on delivery_offers (order_id, status);
create index if not exists delivery_offers_tenant_idx on delivery_offers (tenant_id);
alter table delivery_offers enable row level security;
drop policy if exists "riders see own offers" on delivery_offers;
create policy "riders see own offers" on delivery_offers for select using (rider_id = auth.uid() or is_admin());
drop policy if exists tenant_fence on delivery_offers;
create policy tenant_fence on delivery_offers as restrictive for all
  using (tenant_id = current_tenant_id() or is_super_admin())
  with check (tenant_id = current_tenant_id() or is_super_admin());

-- Orders nobody could be found for, so admins are alerted once (not every minute).
create table if not exists dispatch_alerts (
  order_id uuid primary key references orders(id) on delete cascade,
  alerted_at timestamptz not null default now()
);
alter table dispatch_alerts enable row level security;
drop policy if exists "admins see dispatch alerts" on dispatch_alerts;
create policy "admins see dispatch alerts" on dispatch_alerts for select using (is_admin());

-- 3) Helpers
create or replace function km_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql immutable as $$
  select 6371 * 2 * asin(sqrt(power(sin(radians(lat2 - lat1) / 2), 2) + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)));
$$;

create or replace function express_dispatch_on()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select cs.express_auto_dispatch from company_settings cs where cs.tenant_id = current_tenant_id() limit 1), false);
$$;
grant execute on function express_dispatch_on() to authenticated;

-- 4) Nobody takes an Express order without a live offer (admins can still assign).
drop policy if exists express_offer_gate on delivery_assignments;
create policy express_offer_gate on delivery_assignments as restrictive for insert
  with check (
    is_admin()
    or not exists (select 1 from orders o where o.id = order_id and o.delivery_type = 'express')
    or not express_dispatch_on()
    or exists (select 1 from delivery_offers f where f.order_id = delivery_assignments.order_id and f.rider_id = auth.uid() and f.status = 'offered' and f.expires_at > now())
  );

-- 5) Make one offer for one order. Returns the rider offered, or null (not Express, already taken, a live offer exists, or nobody in range).
create or replace function dispatch_express_order(p_order_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_wlat double precision;
  v_wlng double precision;
  v_on boolean;
  v_base numeric;
  v_max numeric;
  v_secs int;
  v_tries int;
  v_radius numeric;
  v_rider uuid;
  v_dist double precision;
begin
  select * into v_order from orders where id = p_order_id;
  if not found or v_order.delivery_type <> 'express' or v_order.status not in ('preparing', 'ready_for_pickup') then return null; end if;
  if exists (select 1 from delivery_assignments where order_id = p_order_id) then return null; end if;
  select cs.express_auto_dispatch, cs.express_rider_radius_km, cs.express_offer_seconds, cs.rider_pickup_radius_km
    into v_on, v_base, v_secs, v_max from company_settings cs where cs.tenant_id = v_order.tenant_id limit 1;
  if not coalesce(v_on, false) then return null; end if;
  update delivery_offers set status = 'expired', responded_at = now() where order_id = p_order_id and status = 'offered' and expires_at <= now();
  if exists (select 1 from delivery_offers where order_id = p_order_id and status = 'offered') then return null; end if;
  select w.lat, w.lng into v_wlat, v_wlng from warehouses w where w.id = v_order.warehouse_id;
  if v_wlat is null or v_wlng is null then return null; end if;
  select count(*) into v_tries from delivery_offers where order_id = p_order_id;
  v_radius := least(coalesce(v_base, 5) + v_tries * 2, greatest(coalesce(v_max, 20), coalesce(v_base, 5)));
  select dp.id, km_between(dp.current_lat, dp.current_lng, v_wlat, v_wlng) into v_rider, v_dist
  from delivery_partners dp
  join profiles p on p.id = dp.id
  where dp.status::text = 'approved' and dp.is_available and dp.current_lat is not null and dp.current_lng is not null
    and p.tenant_id = v_order.tenant_id
    and km_between(dp.current_lat, dp.current_lng, v_wlat, v_wlng) <= v_radius
    and not exists (select 1 from delivery_assignments da join orders o on o.id = da.order_id where da.rider_id = dp.id and o.status not in ('delivered', 'cancelled'))
    and not exists (select 1 from delivery_offers f where f.order_id = p_order_id and f.rider_id = dp.id)
    and not exists (select 1 from delivery_offers f2 where f2.rider_id = dp.id and f2.status = 'offered' and f2.expires_at > now())
  order by km_between(dp.current_lat, dp.current_lng, v_wlat, v_wlng)
  limit 1;
  if v_rider is null then return null; end if;
  insert into delivery_offers (tenant_id, order_id, rider_id, distance_km, expires_at)
    values (v_order.tenant_id, p_order_id, v_rider, round(v_dist::numeric, 2), now() + make_interval(secs => coalesce(v_secs, 30)));
  return v_rider;
end;
$$;
grant execute on function dispatch_express_order(uuid) to authenticated, service_role;

-- 6) The rider's answer
create or replace function accept_express_offer(p_offer_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_offer delivery_offers%rowtype;
begin
  select * into v_offer from delivery_offers where id = p_offer_id and rider_id = auth.uid() for update;
  if not found then raise exception 'This offer is not available any more.'; end if;
  if v_offer.status <> 'offered' or v_offer.expires_at <= now() then raise exception 'This offer has expired.'; end if;
  if exists (select 1 from delivery_assignments da join orders o on o.id = da.order_id where da.rider_id = auth.uid() and o.status not in ('delivered', 'cancelled')) then
    raise exception 'Finish your current delivery before accepting a new one.';
  end if;
  insert into delivery_assignments (order_id, rider_id, assigned_at) values (v_offer.order_id, auth.uid(), now());
  update delivery_offers set status = 'accepted', responded_at = now() where id = p_offer_id;
  update delivery_offers set status = 'expired', responded_at = now() where order_id = v_offer.order_id and id <> p_offer_id and status = 'offered';
  return v_offer.order_id;
end;
$$;
grant execute on function accept_express_offer(uuid) to authenticated;

create or replace function decline_express_offer(p_offer_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_order uuid;
begin
  update delivery_offers set status = case when expires_at <= now() then 'expired' else 'declined' end, responded_at = now()
    where id = p_offer_id and rider_id = auth.uid() and status = 'offered'
    returning order_id into v_order;
  return v_order;
end;
$$;
grant execute on function decline_express_offer(uuid) to authenticated;

-- 7) Sweep (run every minute by the cron worker): expire old offers, offer waiting orders, flag orders nobody can take.
create or replace function sweep_express_dispatch()
returns table (out_order_id uuid, out_rider_id uuid, out_order_number text, out_alert boolean)
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_rider uuid;
  v_new boolean;
  v_rows int;
begin
  update delivery_offers set status = 'expired', responded_at = now() where status = 'offered' and expires_at <= now();
  for r in
    select o.id, o.order_number, o.created_at from orders o
    where o.delivery_type = 'express' and o.status in ('preparing', 'ready_for_pickup')
      and not exists (select 1 from delivery_assignments da where da.order_id = o.id)
      and not exists (select 1 from delivery_offers f where f.order_id = o.id and f.status = 'offered')
  loop
    v_rider := dispatch_express_order(r.id);
    v_new := false;
    if v_rider is null and r.created_at < now() - interval '4 minutes' then
      insert into dispatch_alerts (order_id) values (r.id) on conflict do nothing;
      get diagnostics v_rows = row_count;
      v_new := v_rows > 0;
    end if;
    out_order_id := r.id;
    out_rider_id := v_rider;
    out_order_number := r.order_number;
    out_alert := v_new;
    if v_rider is not null or v_new then return next; end if;
  end loop;
end;
$$;
grant execute on function sweep_express_dispatch() to service_role;

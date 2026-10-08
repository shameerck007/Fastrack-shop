-- Standard delivery routes for your own riders.
-- Standard / scheduled orders that are ready for pickup are grouped into ONE route per pickup shop and delivery area.
-- A rider takes the whole route (every order in it becomes theirs, with its own OTP, cash and pay) instead of tapping orders one by one.
-- Quick (Express) orders are not touched: they keep the automatic one-rider offers from 0063.
-- Run the whole file in the Supabase SQL editor. No blank lines inside function bodies.

alter table company_settings add column if not exists standard_routes_enabled boolean not null default true;

create table if not exists delivery_routes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id() references tenants(id),
  warehouse_id uuid not null references warehouses(id),
  area_label text not null,
  status text not null default 'open' check (status in ('open', 'assigned', 'completed', 'cancelled')),
  rider_id uuid references delivery_partners(id),
  created_at timestamptz not null default now(),
  assigned_at timestamptz,
  completed_at timestamptz
);
create index if not exists delivery_routes_open_idx on delivery_routes (tenant_id, warehouse_id, status);
create index if not exists delivery_routes_rider_idx on delivery_routes (rider_id, status);

create table if not exists delivery_route_orders (
  order_id uuid primary key references orders(id) on delete cascade,
  route_id uuid not null references delivery_routes(id) on delete cascade,
  tenant_id uuid not null default current_tenant_id() references tenants(id),
  added_at timestamptz not null default now()
);
create index if not exists delivery_route_orders_route_idx on delivery_route_orders (route_id);

alter table delivery_routes enable row level security;
alter table delivery_route_orders enable row level security;
drop policy if exists "riders and admins see routes" on delivery_routes;
create policy "riders and admins see routes" on delivery_routes for select using (is_admin() or is_rider());
drop policy if exists "riders and admins see route orders" on delivery_route_orders;
create policy "riders and admins see route orders" on delivery_route_orders for select using (is_admin() or is_rider());
drop policy if exists tenant_fence on delivery_routes;
create policy tenant_fence on delivery_routes as restrictive for all using (tenant_id = current_tenant_id() or is_super_admin()) with check (tenant_id = current_tenant_id() or is_super_admin());
drop policy if exists tenant_fence on delivery_route_orders;
create policy tenant_fence on delivery_route_orders as restrictive for all using (tenant_id = current_tenant_id() or is_super_admin()) with check (tenant_id = current_tenant_id() or is_super_admin());

-- Put one ready Standard / scheduled order into the open route for its shop and area (creating the route if needed).
create or replace function route_standard_order(p_order_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_on boolean;
  v_area text;
  v_route uuid;
begin
  select * into v_order from orders where id = p_order_id;
  if not found or v_order.delivery_type not in ('standard', 'scheduled') or v_order.status <> 'ready_for_pickup' or v_order.warehouse_id is null then return null; end if;
  select cs.standard_routes_enabled into v_on from company_settings cs where cs.tenant_id = v_order.tenant_id limit 1;
  if not coalesce(v_on, false) then return null; end if;
  select r.route_id into v_route from delivery_route_orders r where r.order_id = p_order_id;
  if v_route is not null then return v_route; end if;
  if exists (select 1 from delivery_assignments where order_id = p_order_id) then return null; end if;
  select coalesce(nullif(trim(a.district), ''), nullif(trim(a.city), ''), 'Area') into v_area from addresses a where a.id = v_order.address_id;
  v_area := coalesce(v_area, 'Area');
  select dr.id into v_route from delivery_routes dr
    where dr.tenant_id = v_order.tenant_id and dr.warehouse_id = v_order.warehouse_id and dr.status = 'open' and lower(dr.area_label) = lower(v_area)
    order by dr.created_at limit 1;
  if v_route is null then
    insert into delivery_routes (tenant_id, warehouse_id, area_label) values (v_order.tenant_id, v_order.warehouse_id, v_area) returning id into v_route;
  end if;
  insert into delivery_route_orders (order_id, route_id, tenant_id) values (p_order_id, v_route, v_order.tenant_id) on conflict (order_id) do nothing;
  return v_route;
end;
$$;
grant execute on function route_standard_order(uuid) to authenticated, service_role;

-- Housekeeping, run every minute by the cron worker: route anything missed, drop cancelled orders, close empty routes.
create or replace function sweep_standard_routes()
returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_count int := 0;
begin
  delete from delivery_route_orders dro using delivery_routes dr, orders o
    where dro.route_id = dr.id and dr.status = 'open' and o.id = dro.order_id and (o.status <> 'ready_for_pickup' or exists (select 1 from delivery_assignments da where da.order_id = o.id));
  update delivery_routes dr set status = 'cancelled' where dr.status = 'open' and not exists (select 1 from delivery_route_orders dro where dro.route_id = dr.id);
  for r in
    select o.id from orders o
    where o.delivery_type in ('standard', 'scheduled') and o.status = 'ready_for_pickup'
      and not exists (select 1 from delivery_assignments da where da.order_id = o.id)
      and not exists (select 1 from delivery_route_orders dro where dro.order_id = o.id)
  loop
    if route_standard_order(r.id) is not null then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end;
$$;
grant execute on function sweep_standard_routes() to service_role;

-- A rider takes the whole route. Every order still ready becomes theirs (the pay is fixed per order by 0064's trigger).
create or replace function accept_route(p_route_id uuid)
returns setof uuid
language plpgsql security definer set search_path = public as $$
declare
  v_route delivery_routes%rowtype;
  v_ids uuid[];
  o record;
begin
  select * into v_route from delivery_routes where id = p_route_id for update;
  if not found or v_route.status <> 'open' then raise exception 'This route has already been taken.'; end if;
  if not exists (select 1 from delivery_partners dp where dp.id = auth.uid() and dp.status::text = 'approved') then raise exception 'Only approved riders can take routes.'; end if;
  if exists (select 1 from delivery_assignments da join orders o2 on o2.id = da.order_id where da.rider_id = auth.uid() and o2.status not in ('delivered', 'cancelled')) then
    raise exception 'Finish your current delivery before taking a route.';
  end if;
  v_ids := array[]::uuid[];
  for o in
    select dro.order_id from delivery_route_orders dro join orders x on x.id = dro.order_id
    where dro.route_id = p_route_id and x.status = 'ready_for_pickup' and not exists (select 1 from delivery_assignments da where da.order_id = x.id)
  loop
    insert into delivery_assignments (order_id, rider_id, assigned_at) values (o.order_id, auth.uid(), now());
    v_ids := v_ids || o.order_id;
  end loop;
  if coalesce(array_length(v_ids, 1), 0) = 0 then raise exception 'This route has no orders left.'; end if;
  update delivery_routes set status = 'assigned', rider_id = auth.uid(), assigned_at = now() where id = p_route_id;
  return query select unnest(v_ids);
end;
$$;
grant execute on function accept_route(uuid) to authenticated;

-- After a delivery: when every order of the route is delivered or cancelled, the route is completed.
create or replace function close_route_if_done(p_order_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_route uuid;
begin
  select route_id into v_route from delivery_route_orders where order_id = p_order_id;
  if v_route is null then return; end if;
  if not exists (
    select 1 from delivery_route_orders dro join delivery_assignments da on da.order_id = dro.order_id join orders o on o.id = da.order_id
    where dro.route_id = v_route and o.status not in ('delivered', 'cancelled')
  ) then
    update delivery_routes set status = 'completed', completed_at = now() where id = v_route and status = 'assigned';
  end if;
end;
$$;
grant execute on function close_route_if_done(uuid) to authenticated;

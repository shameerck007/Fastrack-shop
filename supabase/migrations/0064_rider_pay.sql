-- Rider pay, separate from what the customer pays for delivery.
-- Set in Admin > Business settings: a base amount per delivery plus an amount per km (pickup to customer, +30% for roads).
-- If the base amount is left empty, a rider keeps earning the order's delivery fee, exactly as before.
-- The pay is fixed when the rider takes the order (stored on the assignment), so later setting changes never alter past earnings.
-- Run the whole file in the Supabase SQL editor. No blank lines inside function bodies.

alter table company_settings add column if not exists rider_pay_base numeric check (rider_pay_base is null or rider_pay_base >= 0);
alter table company_settings add column if not exists rider_pay_per_km numeric not null default 0 check (rider_pay_per_km >= 0);
alter table delivery_assignments add column if not exists rider_pay numeric;
alter table delivery_offers add column if not exists rider_pay numeric;

-- What a rider would earn for one order under the market's current settings.
create or replace function rider_pay_for_order(p_order_id uuid)
returns numeric
language plpgsql security definer set search_path = public stable as $$
declare
  v_fee numeric;
  v_tenant uuid;
  v_wlat double precision;
  v_wlng double precision;
  v_alat double precision;
  v_alng double precision;
  v_base numeric;
  v_perkm numeric;
begin
  select o.delivery_fee, o.tenant_id, w.lat, w.lng, a.lat, a.lng into v_fee, v_tenant, v_wlat, v_wlng, v_alat, v_alng
    from orders o left join warehouses w on w.id = o.warehouse_id left join addresses a on a.id = o.address_id where o.id = p_order_id;
  if not found then return null; end if;
  select cs.rider_pay_base, cs.rider_pay_per_km into v_base, v_perkm from company_settings cs where cs.tenant_id = v_tenant limit 1;
  if v_base is null then return v_fee; end if;
  if v_wlat is null or v_wlng is null or v_alat is null or v_alng is null then return round(v_base, 2); end if;
  return round(v_base + coalesce(v_perkm, 0) * (km_between(v_wlat, v_wlng, v_alat, v_alng) * 1.3)::numeric, 2);
end;
$$;
grant execute on function rider_pay_for_order(uuid) to service_role;

-- Estimates for a list of orders (the rider's open list), riders and admins only.
create or replace function rider_pay_estimates(p_order_ids uuid[])
returns table (est_order_id uuid, est_pay numeric)
language plpgsql security definer set search_path = public stable as $$
begin
  if not (is_rider() or is_admin()) then raise exception 'Not allowed.'; end if;
  return query select i, rider_pay_for_order(i) from unnest(p_order_ids) as i;
end;
$$;
grant execute on function rider_pay_estimates(uuid[]) to authenticated;

-- Fix the pay the moment a rider is assigned, however the assignment is made.
create or replace function set_assignment_rider_pay()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.rider_pay is null then new.rider_pay := rider_pay_for_order(new.order_id); end if;
  return new;
end;
$$;
drop trigger if exists trg_assignment_rider_pay on delivery_assignments;
create trigger trg_assignment_rider_pay before insert on delivery_assignments for each row execute function set_assignment_rider_pay();

-- Quick-delivery offers now carry the pay they would earn (0063's function, re-created with that one addition).
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
  insert into delivery_offers (tenant_id, order_id, rider_id, distance_km, rider_pay, expires_at)
    values (v_order.tenant_id, p_order_id, v_rider, round(v_dist::numeric, 2), rider_pay_for_order(p_order_id), now() + make_interval(secs => coalesce(v_secs, 30)));
  return v_rider;
end;
$$;
grant execute on function dispatch_express_order(uuid) to authenticated, service_role;

-- Settlement now counts what riders earned (their pay when set, otherwise the order's delivery fee).
create or replace function rider_settlement_summary(target_rider_id uuid)
returns table (
  delivered_count bigint,
  earned numeric,
  cash_collected numeric,
  paid_out numeric,
  cash_deposited numeric,
  balance numeric
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not (is_admin() or target_rider_id = auth.uid()) then
    raise exception 'Not authorized to view this rider''s settlement.';
  end if;
  return query
    select
      d.cnt,
      d.earned,
      d.cash,
      coalesce(e.paid_out, 0),
      coalesce(e.deposited, 0),
      d.earned - d.cash - coalesce(e.paid_out, 0) + coalesce(e.deposited, 0)
    from (
      select
        count(*) as cnt,
        coalesce(sum(coalesce(da.rider_pay, o.delivery_fee)), 0) as earned,
        coalesce(sum(case when p.method = 'cash_on_delivery' and p.status <> 'refunded' then o.total else 0 end), 0) as cash
      from delivery_assignments da
      join orders o on o.id = da.order_id and o.status = 'delivered'
      left join payments p on p.order_id = o.id
      where da.rider_id = target_rider_id
    ) d
    left join lateral (
      select
        sum(amount) filter (where kind = 'payout') as paid_out,
        sum(amount) filter (where kind = 'cash_deposit') as deposited
      from rider_settlement_entries where rider_id = target_rider_id
    ) e on true;
end;
$$;

create or replace function rider_settlement_orders(target_rider_id uuid)
returns table (
  order_id uuid,
  order_number text,
  delivered_at timestamptz,
  delivery_fee numeric,
  order_total numeric,
  cash_collected numeric
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not (is_admin() or target_rider_id = auth.uid()) then
    raise exception 'Not authorized to view this rider''s settlement.';
  end if;
  return query
    select
      o.id,
      o.order_number,
      da.delivered_at,
      coalesce(da.rider_pay, o.delivery_fee),
      o.total,
      case when p.method = 'cash_on_delivery' and p.status <> 'refunded' then o.total else 0::numeric end
    from delivery_assignments da
    join orders o on o.id = da.order_id and o.status = 'delivered'
    left join payments p on p.order_id = o.id
    where da.rider_id = target_rider_id
    order by da.delivered_at desc nulls last;
end;
$$;

create or replace function admin_rider_settlement_overview()
returns table (
  rider_id uuid,
  rider_name text,
  rider_status rider_status,
  payout_method text,
  delivered_count bigint,
  earned numeric,
  cash_collected numeric,
  paid_out numeric,
  cash_deposited numeric,
  balance numeric
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not is_admin() then
    raise exception 'Only admins can view the rider settlement overview.';
  end if;
  return query
    select
      dp.id,
      coalesce(pr.full_name, '—'),
      dp.status,
      dp.payout_method,
      coalesce(d.cnt, 0),
      coalesce(d.earned, 0),
      coalesce(d.cash, 0),
      coalesce(e.paid_out, 0),
      coalesce(e.deposited, 0),
      coalesce(d.earned, 0) - coalesce(d.cash, 0) - coalesce(e.paid_out, 0) + coalesce(e.deposited, 0)
    from delivery_partners dp
    left join profiles pr on pr.id = dp.id
    left join lateral (
      select
        count(*) as cnt,
        sum(coalesce(da.rider_pay, o.delivery_fee)) as earned,
        sum(case when p.method = 'cash_on_delivery' and p.status <> 'refunded' then o.total else 0 end) as cash
      from delivery_assignments da
      join orders o on o.id = da.order_id and o.status = 'delivered'
      left join payments p on p.order_id = o.id
      where da.rider_id = dp.id
    ) d on true
    left join lateral (
      select
        sum(se.amount) filter (where se.kind = 'payout') as paid_out,
        sum(se.amount) filter (where se.kind = 'cash_deposit') as deposited
      from rider_settlement_entries se where se.rider_id = dp.id
    ) e on true
    where dp.status in ('approved', 'suspended')
    order by abs(coalesce(d.earned, 0) - coalesce(d.cash, 0) - coalesce(e.paid_out, 0) + coalesce(e.deposited, 0)) desc;
end;
$$;
grant execute on function rider_settlement_summary(uuid) to authenticated;
grant execute on function rider_settlement_orders(uuid) to authenticated;
grant execute on function admin_rider_settlement_overview() to authenticated;

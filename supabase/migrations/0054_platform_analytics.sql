-- Read-only analytics for the platform owner (super_admin). Every figure is grouped by market
-- (tenant) so different currencies are never added together. No blank lines inside functions
-- (the Supabase SQL editor splits on them).
create or replace function platform_market_summary()
returns table (tenant_id uuid, slug text, name text, country_code text, currency text, status text, orders_total bigint, orders_today bigint, orders_30d bigint, delivered_30d bigint, cancelled_30d bigint, gmv_today numeric, gmv_30d numeric, avg_order_30d numeric, delivery_fees_30d numeric, tax_30d numeric, commission_30d numeric, suppliers_active bigint, suppliers_pending bigint, riders_approved bigint, riders_pending bigint, riders_online bigint, customers_total bigint, customers_new_30d bigint, products_active bigint, supplier_payable numeric, rider_cash_held numeric)
language plpgsql security definer set search_path = public stable
as $$
begin
  if not is_super_admin() then raise exception 'Platform owners only.'; end if;
  return query
  select t.id, t.slug, t.name, t.country_code, t.currency, t.status,
    (select count(*) from orders o where o.tenant_id = t.id),
    (select count(*) from orders o where o.tenant_id = t.id and (o.created_at at time zone tz.name)::date = (now() at time zone tz.name)::date),
    (select count(*) from orders o where o.tenant_id = t.id and o.created_at >= now() - interval '30 days'),
    (select count(*) from orders o where o.tenant_id = t.id and o.status = 'delivered' and o.created_at >= now() - interval '30 days'),
    (select count(*) from orders o where o.tenant_id = t.id and o.status = 'cancelled' and o.created_at >= now() - interval '30 days'),
    coalesce((select sum(o.total) from orders o where o.tenant_id = t.id and o.status <> 'cancelled' and (o.created_at at time zone tz.name)::date = (now() at time zone tz.name)::date), 0),
    coalesce((select sum(o.total) from orders o where o.tenant_id = t.id and o.status <> 'cancelled' and o.created_at >= now() - interval '30 days'), 0),
    coalesce((select avg(o.total) from orders o where o.tenant_id = t.id and o.status <> 'cancelled' and o.created_at >= now() - interval '30 days'), 0),
    coalesce((select sum(o.delivery_fee) from orders o where o.tenant_id = t.id and o.status = 'delivered' and o.created_at >= now() - interval '30 days'), 0),
    coalesce((select sum(o.vat) from orders o where o.tenant_id = t.id and o.status = 'delivered' and o.created_at >= now() - interval '30 days'), 0),
    coalesce((select sum(oi.line_total * s.commission_rate / 100) from order_items oi join product_variants pv on pv.id = oi.variant_id join products p on p.id = pv.product_id join stores s on s.id = p.store_id join orders o on o.id = oi.order_id where o.tenant_id = t.id and o.status = 'delivered' and o.created_at >= now() - interval '30 days'), 0),
    (select count(*) from stores s where s.tenant_id = t.id and s.status = 'approved'),
    (select count(*) from stores s where s.tenant_id = t.id and s.status = 'pending'),
    (select count(*) from delivery_partners d where d.tenant_id = t.id and d.status = 'approved'),
    (select count(*) from delivery_partners d where d.tenant_id = t.id and d.status = 'pending'),
    (select count(*) from delivery_partners d where d.tenant_id = t.id and d.status = 'approved' and d.is_available),
    (select count(*) from profiles p where p.tenant_id = t.id and p.role::text = 'customer'),
    (select count(*) from profiles p where p.tenant_id = t.id and p.role::text = 'customer' and p.created_at >= now() - interval '30 days'),
    (select count(*) from products p where p.tenant_id = t.id and p.is_active),
    coalesce((select sum(greatest(0, (sales.net - coalesce(paid.amount, 0)))) from stores s left join lateral (select sum(oi.line_total) * (1 - s.commission_rate / 100) as net from order_items oi join product_variants pv on pv.id = oi.variant_id join products p on p.id = pv.product_id join orders o on o.id = oi.order_id where p.store_id = s.id and o.status = 'delivered') sales on true left join lateral (select sum(sp.amount) as amount from settlement_payouts sp where sp.store_id = s.id) paid on true where s.tenant_id = t.id), 0),
    coalesce((select sum(greatest(0, -r.balance)) from admin_rider_settlement_overview() r join delivery_partners d on d.id = r.rider_id where d.tenant_id = t.id), 0)
  from tenants t
  cross join lateral (select case when t.country_code = 'IN' then 'Asia/Kolkata' else 'Asia/Riyadh' end as name) tz
  order by t.is_default desc, t.created_at;
end;
$$;
create or replace function platform_sales_by_day(p_days int default 14)
returns table (tenant_id uuid, day date, orders bigint, gmv numeric, delivery_fees numeric, tax numeric)
language plpgsql security definer set search_path = public stable
as $$
begin
  if not is_super_admin() then raise exception 'Platform owners only.'; end if;
  return query
  select o.tenant_id, (o.created_at at time zone case when t.country_code = 'IN' then 'Asia/Kolkata' else 'Asia/Riyadh' end)::date as d, count(*), sum(o.total), sum(o.delivery_fee), sum(o.vat)
  from orders o join tenants t on t.id = o.tenant_id
  where o.status <> 'cancelled' and o.created_at >= now() - make_interval(days => greatest(1, least(p_days, 366)))
  group by o.tenant_id, d order by d;
end;
$$;
create or replace function platform_top_suppliers(p_days int default 30, p_limit int default 5)
returns table (tenant_id uuid, store_id uuid, store_name text, orders bigint, gross_sales numeric, commission numeric)
language plpgsql security definer set search_path = public stable
as $$
begin
  if not is_super_admin() then raise exception 'Platform owners only.'; end if;
  return query
  select x.tid, x.sid, x.sname, x.orders, x.gross, x.commission from (
    select s.tenant_id as tid, s.id as sid, s.name as sname, count(distinct o.id) as orders, sum(oi.line_total) as gross, sum(oi.line_total * s.commission_rate / 100) as commission,
      row_number() over (partition by s.tenant_id order by sum(oi.line_total) desc) as rn
    from order_items oi join product_variants pv on pv.id = oi.variant_id join products p on p.id = pv.product_id join stores s on s.id = p.store_id join orders o on o.id = oi.order_id
    where o.status = 'delivered' and o.created_at >= now() - make_interval(days => greatest(1, least(p_days, 366)))
    group by s.tenant_id, s.id, s.name
  ) x where x.rn <= greatest(1, least(p_limit, 50)) order by x.tid, x.gross desc;
end;
$$;
create or replace function platform_status_counts()
returns table (tenant_id uuid, status text, cnt bigint)
language plpgsql security definer set search_path = public stable
as $$
begin
  if not is_super_admin() then raise exception 'Platform owners only.'; end if;
  return query
  select o.tenant_id, o.status::text, count(*) from orders o where o.created_at >= now() - interval '30 days' group by o.tenant_id, o.status;
end;
$$;
create or replace function platform_attention()
returns table (tenant_id uuid, kind text, cnt bigint)
language plpgsql security definer set search_path = public stable
as $$
begin
  if not is_super_admin() then raise exception 'Platform owners only.'; end if;
  return query
  select o.tenant_id, 'orders_waiting_confirmation', count(*) from orders o where o.status = 'pending' and o.created_at < now() - interval '10 minutes' group by o.tenant_id
  union all
  select o.tenant_id, 'ready_no_rider', count(*) from orders o where o.status = 'ready_for_pickup' and o.updated_at < now() - interval '10 minutes' group by o.tenant_id
  union all
  select s.tenant_id, 'supplier_applications', count(*) from stores s where s.status = 'pending' group by s.tenant_id
  union all
  select d.tenant_id, 'rider_applications', count(*) from delivery_partners d where d.status = 'pending' group by d.tenant_id;
end;
$$;
grant execute on function platform_market_summary() to authenticated;
grant execute on function platform_sales_by_day(int) to authenticated;
grant execute on function platform_top_suppliers(int, int) to authenticated;
grant execute on function platform_status_counts() to authenticated;
grant execute on function platform_attention() to authenticated;

-- Business dashboard for the admin: everything on one screen comes from this one function, worked out in the database
-- (so it stays right when there are thousands of orders), for the current market only.
-- p_days: the period length; the period before it, of the same length, is returned too so every figure can show its change.
-- p_tz: the market's time zone, so "today" and the hours of the day are the shop's own.
-- Run in the Supabase SQL editor. Safe to run more than once. No blank lines inside the function body.

create or replace function admin_dashboard(p_days int default 30, p_tz text default 'UTC')
returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare
  v_tenant uuid := current_tenant_id();
  v_days int := greatest(1, least(coalesce(p_days, 30), 365));
  v_today date := (now() at time zone p_tz)::date;
  v_start date;
  v_prev date;
  v_res jsonb;
begin
  if not is_admin() then
    raise exception 'Only admins can view the dashboard.';
  end if;
  v_start := v_today - (v_days - 1);
  v_prev := v_start - v_days;
  with o as (
    select id, user_id, status::text as status, total, delivery_fee, discount, delivery_type::text as dt, created_at,
           (created_at at time zone p_tz) as lt, (created_at at time zone p_tz)::date as d
    from orders
    where tenant_id = v_tenant and (created_at at time zone p_tz)::date >= v_prev
  ),
  items as (
    select oi.order_id, oi.line_total, oi.ordered_quantity, oi.product_name, coalesce(oi.commission_amount, 0) as commission, p.store_id, p.category_id, o.d
    from order_items oi
    join o on o.id = oi.order_id and o.status <> 'cancelled'
    left join product_variants pv on pv.id = oi.variant_id
    left join products p on p.id = pv.product_id
  )
  select jsonb_build_object(
    'days', v_days,
    'start', v_start,
    'today', v_today,
    'cur', (select jsonb_build_object(
        'revenue', coalesce(sum(total) filter (where status <> 'cancelled'), 0),
        'orders', count(*) filter (where status <> 'cancelled'),
        'placed', count(*),
        'cancelled', count(*) filter (where status = 'cancelled'),
        'delivered', count(*) filter (where status = 'delivered'),
        'buyers', count(distinct user_id) filter (where status <> 'cancelled'),
        'discounts', coalesce(sum(discount) filter (where status <> 'cancelled'), 0),
        'delivery_fees', coalesce(sum(delivery_fee) filter (where status <> 'cancelled'), 0)
      ) from o where d >= v_start),
    'prev', (select jsonb_build_object(
        'revenue', coalesce(sum(total) filter (where status <> 'cancelled'), 0),
        'orders', count(*) filter (where status <> 'cancelled'),
        'placed', count(*),
        'cancelled', count(*) filter (where status = 'cancelled'),
        'delivered', count(*) filter (where status = 'delivered'),
        'buyers', count(distinct user_id) filter (where status <> 'cancelled'),
        'discounts', coalesce(sum(discount) filter (where status <> 'cancelled'), 0),
        'delivery_fees', coalesce(sum(delivery_fee) filter (where status <> 'cancelled'), 0)
      ) from o where d >= v_prev and d < v_start),
    'commission', jsonb_build_object(
        'cur', (select coalesce(sum(commission), 0) from items where d >= v_start),
        'prev', (select coalesce(sum(commission), 0) from items where d >= v_prev and d < v_start)),
    'signups', jsonb_build_object(
        'cur', (select count(*) from profiles where tenant_id = v_tenant and role = 'customer' and (created_at at time zone p_tz)::date >= v_start),
        'prev', (select count(*) from profiles where tenant_id = v_tenant and role = 'customer' and (created_at at time zone p_tz)::date >= v_prev and (created_at at time zone p_tz)::date < v_start),
        'total', (select count(*) from profiles where tenant_id = v_tenant and role = 'customer')),
    'series', (select coalesce(jsonb_agg(jsonb_build_object('date', g.d::date, 'revenue', coalesce(x.rev, 0), 'orders', coalesce(x.n, 0)) order by g.d), '[]'::jsonb)
        from generate_series(v_start, v_today, interval '1 day') as g(d)
        left join (select d, sum(total) as rev, count(*) as n from o where status <> 'cancelled' group by d) x on x.d = g.d::date),
    'series_prev', (select coalesce(jsonb_agg(jsonb_build_object('date', g.d::date, 'revenue', coalesce(x.rev, 0), 'orders', coalesce(x.n, 0)) order by g.d), '[]'::jsonb)
        from generate_series(v_prev, v_start - 1, interval '1 day') as g(d)
        left join (select d, sum(total) as rev, count(*) as n from o where status <> 'cancelled' group by d) x on x.d = g.d::date),
    'status', (select coalesce(jsonb_object_agg(s.status, s.n), '{}'::jsonb) from (select status, count(*) as n from o where d >= v_start group by status) s),
    'delivery_types', (select coalesce(jsonb_object_agg(s.dt, s.n), '{}'::jsonb) from (select dt, count(*) as n from o where d >= v_start and status <> 'cancelled' group by dt) s),
    'heat', (select coalesce(jsonb_agg(jsonb_build_array(h.dow, h.hr, h.n)), '[]'::jsonb)
        from (select extract(isodow from lt)::int as dow, extract(hour from lt)::int as hr, count(*) as n from o where d >= v_start and status <> 'cancelled' group by 1, 2) h),
    'top_categories', (select coalesce(jsonb_agg(r order by r.value desc), '[]'::jsonb) from (
        select coalesce(pc.name, c.name, 'Uncategorized') as label, round(sum(i.line_total), 2) as value, sum(i.ordered_quantity) as qty
        from items i left join categories c on c.id = i.category_id left join categories pc on pc.id = c.parent_id
        where i.d >= v_start group by 1 order by 2 desc limit 6) r),
    'top_products', (select coalesce(jsonb_agg(r order by r.value desc), '[]'::jsonb) from (
        select i.product_name as label, round(sum(i.line_total), 2) as value, sum(i.ordered_quantity) as qty
        from items i where i.d >= v_start group by 1 order by 2 desc limit 6) r),
    'top_suppliers', (select coalesce(jsonb_agg(r order by r.value desc), '[]'::jsonb) from (
        select coalesce(s.name, 'FasTrack') as label, round(sum(i.line_total), 2) as value, count(distinct i.order_id) as orders, round(sum(i.commission), 2) as commission
        from items i left join stores s on s.id = i.store_id
        where i.d >= v_start group by 1 order by 2 desc limit 6) r),
    'sales_source', (select coalesce(jsonb_object_agg(r.src, r.value), '{}'::jsonb) from (
        select case when i.store_id is null then 'fastrack' else 'suppliers' end as src, round(sum(i.line_total), 2) as value
        from items i where i.d >= v_start group by 1) r),
    'buyers_split', (select jsonb_build_object(
        'returning', count(*) filter (where b.returning_buyer),
        'new', count(*) filter (where not b.returning_buyer)
      ) from (
        select distinct o.user_id, exists (select 1 from orders x where x.user_id = o.user_id and x.tenant_id = v_tenant and x.status::text <> 'cancelled' and (x.created_at at time zone p_tz)::date < v_start) as returning_buyer
        from o where o.d >= v_start and o.status <> 'cancelled') b),
    'attention', jsonb_build_object(
        'pending_orders', (select count(*) from orders where tenant_id = v_tenant and status::text = 'pending'),
        'awaiting_rider', (select count(*) from orders where tenant_id = v_tenant and status::text = 'ready_for_pickup'),
        'out_for_delivery', (select count(*) from orders where tenant_id = v_tenant and status::text = 'out_for_delivery'),
        'low_stock', (select count(*) from inventory where tenant_id = v_tenant and stock < min_stock),
        'pending_merchants', (select count(*) from stores where tenant_id = v_tenant and status::text = 'pending'),
        'pending_riders', (select count(*) from delivery_partners where tenant_id = v_tenant and status::text = 'pending')),
    'recent', (select coalesce(jsonb_agg(r order by r.created_at desc), '[]'::jsonb) from (
        select id, order_number, status::text as status, total, created_at, delivery_type::text as delivery_type from orders where tenant_id = v_tenant order by created_at desc limit 8) r)
  ) into v_res;
  return v_res;
end;
$$;
grant execute on function admin_dashboard(int, text) to authenticated;

-- Refunds, tax and statements in the settlement engine, and the platform earnings report.
--  * order_refunds / order_refund_items: a refund by item and quantity (and optionally the delivery fee). It reverses what the supplier
--    was paid, FasTrack's commission, any supplier-funded discount and the tax inside, in the same proportion as the units returned.
--  * Settlement functions now net refunds off and report the tax inside the sales.
--  * supplier_statement(): a period statement with opening balance, sales, refunds, commission, tax, payouts and closing balance.
--  * platform_earnings(): what FasTrack actually earns in a period.
-- Run in the Supabase SQL editor. Safe to run more than once. No blank lines inside function bodies.

alter table orders add column if not exists refunded_amount numeric not null default 0;

create table if not exists order_refunds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id() references tenants(id),
  order_id uuid not null references orders(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  delivery_amount numeric not null default 0,
  reason text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists order_refunds_order_idx on order_refunds (order_id);
create table if not exists order_refund_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id() references tenants(id),
  refund_id uuid not null references order_refunds(id) on delete cascade,
  order_item_id uuid not null references order_items(id) on delete cascade,
  quantity numeric not null check (quantity > 0),
  line_amount numeric not null default 0,
  amount numeric not null default 0,
  commission_reversed numeric not null default 0,
  supplier_discount_reversed numeric not null default 0,
  tax_reversed numeric not null default 0
);
create index if not exists order_refund_items_item_idx on order_refund_items (order_item_id);
create index if not exists order_refund_items_refund_idx on order_refund_items (refund_id);

alter table order_refunds enable row level security;
alter table order_refund_items enable row level security;
drop policy if exists tenant_fence on order_refunds;
create policy tenant_fence on order_refunds as restrictive for all
  using (tenant_id = (select current_tenant_id()) or (select is_super_admin()))
  with check (tenant_id = (select current_tenant_id()) or (select is_super_admin()));
drop policy if exists tenant_fence on order_refund_items;
create policy tenant_fence on order_refund_items as restrictive for all
  using (tenant_id = (select current_tenant_id()) or (select is_super_admin()))
  with check (tenant_id = (select current_tenant_id()) or (select is_super_admin()));
drop policy if exists "admins read refunds" on order_refunds;
create policy "admins read refunds" on order_refunds for select using ((select is_admin()) or owns_order(order_id));
drop policy if exists "admins read refund items" on order_refund_items;
create policy "admins read refund items" on order_refund_items for select using ((select is_admin()));

-- Refunds that were only marked before (payment status 'refunded', no item detail): treat them as full refunds of the order.
insert into order_refunds (tenant_id, order_id, amount, delivery_amount, reason)
  select o.tenant_id, o.id, o.total, o.delivery_fee, 'Refunded before itemised refunds'
  from orders o join payments p on p.order_id = o.id
  where p.status::text = 'refunded' and not exists (select 1 from order_refunds r where r.order_id = o.id);
insert into order_refund_items (tenant_id, refund_id, order_item_id, quantity, line_amount, amount, commission_reversed, supplier_discount_reversed, tax_reversed)
  select r.tenant_id, r.id, oi.id, oi.ordered_quantity, oi.line_total, oi.line_total - coalesce(oi.discount_amount, 0), coalesce(oi.commission_amount, 0), coalesce(oi.supplier_discount, 0), coalesce(oi.tax_amount, 0)
  from order_refunds r join order_items oi on oi.order_id = r.order_id
  where r.reason = 'Refunded before itemised refunds' and not exists (select 1 from order_refund_items x where x.refund_id = r.id);
update orders o set refunded_amount = r.amount from order_refunds r where r.order_id = o.id and o.refunded_amount = 0 and r.reason = 'Refunded before itemised refunds';

-- Admin refunds some or all units of an order (and optionally the delivery fee).
-- p_items: [{"order_item_id": "...", "quantity": 1}, ...]
create or replace function admin_refund_order(p_order uuid, p_items jsonb, p_delivery boolean, p_reason text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o orders%rowtype;
  it jsonb;
  oi order_items%rowtype;
  v_qty numeric;
  v_done numeric;
  v_ratio numeric;
  v_refund uuid;
  v_total numeric := 0;
  v_delivery numeric := 0;
  v_amount numeric;
begin
  if not is_admin() then
    raise exception 'Only admins can refund an order.';
  end if;
  select * into o from orders where id = p_order and tenant_id = current_tenant_id();
  if not found then
    raise exception 'Order not found.';
  end if;
  if o.status::text = 'cancelled' then
    raise exception 'A cancelled order has nothing to refund.';
  end if;
  if p_delivery and o.delivery_fee > 0 and not exists (select 1 from order_refunds r where r.order_id = o.id and r.delivery_amount > 0) then
    v_delivery := o.delivery_fee;
  end if;
  if (p_items is null or jsonb_array_length(p_items) = 0) and v_delivery = 0 then
    raise exception 'Choose what to refund.';
  end if;
  insert into order_refunds (tenant_id, order_id, amount, delivery_amount, reason, created_by) values (o.tenant_id, o.id, 0, v_delivery, nullif(trim(p_reason), ''), auth.uid()) returning id into v_refund;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    select * into oi from order_items where id = (it->>'order_item_id')::uuid and order_id = o.id;
    if not found then
      raise exception 'An item does not belong to this order.';
    end if;
    v_qty := (it->>'quantity')::numeric;
    if v_qty is null or v_qty <= 0 then
      continue;
    end if;
    select coalesce(sum(x.quantity), 0) into v_done from order_refund_items x where x.order_item_id = oi.id;
    if v_qty > oi.ordered_quantity - v_done then
      raise exception 'You can refund at most % more of "%".', oi.ordered_quantity - v_done, oi.product_name;
    end if;
    v_ratio := v_qty / oi.ordered_quantity;
    v_amount := round((oi.line_total - coalesce(oi.discount_amount, 0)) * v_ratio, 2);
    insert into order_refund_items (tenant_id, refund_id, order_item_id, quantity, line_amount, amount, commission_reversed, supplier_discount_reversed, tax_reversed)
      values (o.tenant_id, v_refund, oi.id, v_qty, round(oi.line_total * v_ratio, 2), v_amount, round(coalesce(oi.commission_amount, 0) * v_ratio, 2), round(coalesce(oi.supplier_discount, 0) * v_ratio, 2), round(coalesce(oi.tax_amount, 0) * v_ratio, 2));
    v_total := v_total + v_amount;
  end loop;
  v_total := v_total + v_delivery;
  if v_total <= 0 then
    raise exception 'Choose what to refund.';
  end if;
  update order_refunds set amount = v_total where id = v_refund;
  update orders set refunded_amount = refunded_amount + v_total where id = o.id returning * into o;
  if o.refunded_amount >= o.total - 0.01 then
    update payments set status = 'refunded' where order_id = o.id;
  end if;
  return jsonb_build_object('refund_id', v_refund, 'amount', v_total, 'full', o.refunded_amount >= o.total - 0.01, 'user_id', o.user_id, 'order_number', o.order_number);
end;
$$;
grant execute on function admin_refund_order(uuid, jsonb, boolean, text) to authenticated;

-- The figures behind every settlement view, for one supplier and an optional delivered-date window (null = no limit).
-- Internal: the wrappers below check who is asking.
create or replace function settlement_figures(p_store uuid, p_from timestamptz, p_to timestamptz)
returns table (gross numeric, refunds numeric, commission numeric, commission_reversed numeric, funded numeric, funded_reversed numeric, tax numeric, tax_reversed numeric, order_count bigint, refunded_orders bigint)
language sql stable security definer set search_path = public as $$
  with d as (
    select o.id as order_id,
           (select max(h.created_at) from order_status_history h where h.order_id = o.id and h.status = 'delivered') as delivered_at
    from orders o
    where o.status = 'delivered'
      and exists (select 1 from order_items oi join product_variants pv on pv.id = oi.variant_id join products p on p.id = pv.product_id where oi.order_id = o.id and p.store_id = p_store)
  ), win as (
    select order_id from d where (p_from is null or delivered_at >= p_from) and (p_to is null or delivered_at < p_to)
  ), li as (
    select oi.id, oi.order_id, oi.line_total, coalesce(oi.commission_amount, oi.line_total * s.commission_rate / 100) as commission, coalesce(oi.supplier_discount, 0) as funded, coalesce(oi.tax_amount, 0) as tax
    from order_items oi
    join win on win.order_id = oi.order_id
    join product_variants pv on pv.id = oi.variant_id
    join products p on p.id = pv.product_id
    join stores s on s.id = p.store_id
    where p.store_id = p_store
  ), rf as (
    select ri.order_item_id, sum(ri.line_amount) as line_amount, sum(ri.commission_reversed) as commission, sum(ri.supplier_discount_reversed) as funded, sum(ri.tax_reversed) as tax
    from order_refund_items ri join li on li.id = ri.order_item_id group by ri.order_item_id
  )
  select coalesce(sum(li.line_total), 0), coalesce(sum(rf.line_amount), 0), coalesce(sum(li.commission), 0), coalesce(sum(rf.commission), 0),
         coalesce(sum(li.funded), 0), coalesce(sum(rf.funded), 0), coalesce(sum(li.tax), 0), coalesce(sum(rf.tax), 0),
         count(distinct li.order_id), count(distinct li.order_id) filter (where rf.order_item_id is not null)
  from li left join rf on rf.order_item_id = li.id;
$$;
revoke execute on function settlement_figures(uuid, timestamptz, timestamptz) from public, anon, authenticated;

-- One supplier's settlement summary (all time): net of refunds, with the tax inside the sales.
drop function if exists store_settlement_summary(uuid);
create or replace function store_settlement_summary(target_store_id uuid)
returns table (gross_sales numeric, commission_rate numeric, commission_amount numeric, net_earned numeric, paid_out numeric, balance_due numeric, delivered_order_count bigint, refunds numeric, tax_inside numeric)
language plpgsql security definer set search_path = public stable as $$
declare
  f record;
  v_paid numeric;
  v_rate numeric;
begin
  if not (exists (select 1 from stores s where s.id = target_store_id and s.owner_id = auth.uid())
          or (is_admin() and exists (select 1 from stores s where s.id = target_store_id and s.tenant_id = current_tenant_id()))) then
    raise exception 'Not authorized to view this store''s settlement.';
  end if;
  select * into f from settlement_figures(target_store_id, null, null);
  select coalesce(sum(sp.amount), 0) into v_paid from settlement_payouts sp where sp.store_id = target_store_id;
  select st.commission_rate into v_rate from stores st where st.id = target_store_id;
  return query select
    f.gross,
    case when f.gross - f.refunds > 0 then round((f.commission - f.commission_reversed) / (f.gross - f.refunds) * 100, 2) else v_rate end,
    f.commission - f.commission_reversed,
    f.gross - f.refunds - (f.commission - f.commission_reversed) - (f.funded - f.funded_reversed),
    v_paid,
    f.gross - f.refunds - (f.commission - f.commission_reversed) - (f.funded - f.funded_reversed) - v_paid,
    f.order_count,
    f.refunds,
    f.tax - f.tax_reversed;
end;
$$;
grant execute on function store_settlement_summary(uuid) to authenticated;

-- Every supplier of the admin's market.
drop function if exists admin_settlement_overview();
create or replace function admin_settlement_overview()
returns table (store_id uuid, store_name text, store_status store_status, gross_sales numeric, commission_rate numeric, commission_amount numeric, net_earned numeric, paid_out numeric, balance_due numeric, delivered_order_count bigint, refunds numeric, tax_inside numeric)
language plpgsql security definer set search_path = public stable as $$
begin
  if not is_admin() then
    raise exception 'Only admins can view the settlement overview.';
  end if;
  return query
    select s.id, s.name, s.status, f.gross,
           case when f.gross - f.refunds > 0 then round((f.commission - f.commission_reversed) / (f.gross - f.refunds) * 100, 2) else s.commission_rate end,
           f.commission - f.commission_reversed,
           f.gross - f.refunds - (f.commission - f.commission_reversed) - (f.funded - f.funded_reversed),
           coalesce(pay.paid, 0),
           f.gross - f.refunds - (f.commission - f.commission_reversed) - (f.funded - f.funded_reversed) - coalesce(pay.paid, 0),
           f.order_count, f.refunds, f.tax - f.tax_reversed
    from stores s
    cross join lateral settlement_figures(s.id, null, null) f
    left join lateral (select sum(sp.amount) as paid from settlement_payouts sp where sp.store_id = s.id) pay on true
    where s.tenant_id = current_tenant_id()
    order by (f.gross - f.refunds - (f.commission - f.commission_reversed) - (f.funded - f.funded_reversed) - coalesce(pay.paid, 0)) desc nulls last;
end;
$$;
grant execute on function admin_settlement_overview() to authenticated;

-- Order-by-order breakdown behind a supplier's summary.
drop function if exists store_settlement_orders(uuid);
create or replace function store_settlement_orders(target_store_id uuid)
returns table (order_id uuid, order_number text, delivered_at timestamptz, item_count bigint, line_total numeric, commission_amount numeric, net_amount numeric, refunded numeric, tax_amount numeric)
language plpgsql security definer set search_path = public stable as $$
begin
  if not (exists (select 1 from stores s where s.id = target_store_id and s.owner_id = auth.uid())
          or (is_admin() and exists (select 1 from stores s where s.id = target_store_id and s.tenant_id = current_tenant_id()))) then
    raise exception 'Not authorized to view this store''s settlement.';
  end if;
  return query
    select o.id, o.order_number,
      (select max(h.created_at) from order_status_history h where h.order_id = o.id and h.status = 'delivered'),
      count(oi.id),
      sum(oi.line_total),
      sum(coalesce(oi.commission_amount, oi.line_total * s.commission_rate / 100)) - coalesce(sum(r.commission), 0),
      sum(oi.line_total) - coalesce(sum(r.line_amount), 0) - (sum(coalesce(oi.commission_amount, oi.line_total * s.commission_rate / 100)) - coalesce(sum(r.commission), 0)) - (sum(coalesce(oi.supplier_discount, 0)) - coalesce(sum(r.funded), 0)),
      coalesce(sum(r.line_amount), 0),
      sum(coalesce(oi.tax_amount, 0)) - coalesce(sum(r.tax), 0)
    from order_items oi
    join product_variants pv on pv.id = oi.variant_id
    join products p on p.id = pv.product_id
    join stores s on s.id = p.store_id
    join orders o on o.id = oi.order_id
    left join lateral (select sum(ri.line_amount) as line_amount, sum(ri.commission_reversed) as commission, sum(ri.supplier_discount_reversed) as funded, sum(ri.tax_reversed) as tax from order_refund_items ri where ri.order_item_id = oi.id) r on true
    where p.store_id = target_store_id and o.status = 'delivered'
    group by o.id, o.order_number
    order by max(o.updated_at) desc;
end;
$$;
grant execute on function store_settlement_orders(uuid) to authenticated;

-- A statement for a period of delivered dates: opening balance, what happened in the period, closing balance.
create or replace function supplier_statement(p_store uuid, p_from date, p_to date, p_tz text default 'UTC')
returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare
  v_from timestamptz := (p_from::timestamp at time zone p_tz);
  v_to timestamptz := ((p_to + 1)::timestamp at time zone p_tz);
  st stores%rowtype;
  op record;
  cur record;
  v_paid_before numeric;
  v_paid_in numeric;
  v_open numeric;
  v_net numeric;
begin
  if not (exists (select 1 from stores x where x.id = p_store and x.owner_id = auth.uid())
          or (is_admin() and exists (select 1 from stores x where x.id = p_store and x.tenant_id = current_tenant_id()))) then
    raise exception 'Not authorized to view this statement.';
  end if;
  select * into st from stores where id = p_store;
  select * into op from settlement_figures(p_store, null, v_from);
  select * into cur from settlement_figures(p_store, v_from, v_to);
  select coalesce(sum(amount), 0) into v_paid_before from settlement_payouts where store_id = p_store and created_at < v_from;
  select coalesce(sum(amount), 0) into v_paid_in from settlement_payouts where store_id = p_store and created_at >= v_from and created_at < v_to;
  v_open := op.gross - op.refunds - (op.commission - op.commission_reversed) - (op.funded - op.funded_reversed) - v_paid_before;
  v_net := cur.gross - cur.refunds - (cur.commission - cur.commission_reversed) - (cur.funded - cur.funded_reversed);
  return jsonb_build_object(
    'store', jsonb_build_object('name', st.name, 'city', st.city, 'vat_number', st.vat_number, 'cr_number', st.cr_number),
    'from', p_from, 'to', p_to,
    'opening_balance', round(v_open, 2),
    'sales', round(cur.gross, 2),
    'refunds', round(cur.refunds, 2),
    'commission', round(cur.commission - cur.commission_reversed, 2),
    'supplier_discounts', round(cur.funded - cur.funded_reversed, 2),
    'tax_inside', round(cur.tax - cur.tax_reversed, 2),
    'net_for_period', round(v_net, 2),
    'paid_in_period', round(v_paid_in, 2),
    'closing_balance', round(v_open + v_net - v_paid_in, 2),
    'orders', cur.order_count,
    'order_rows', coalesce((
      select jsonb_agg(jsonb_build_object('order_number', x.order_number, 'delivered_at', x.delivered_at, 'sales', x.sales, 'refunded', x.refunded, 'commission', x.commission, 'tax', x.tax, 'net', x.net) order by x.delivered_at)
      from (
        select o.order_number,
               (select max(h.created_at) from order_status_history h where h.order_id = o.id and h.status = 'delivered') as delivered_at,
               round(sum(oi.line_total), 2) as sales,
               round(coalesce(sum(r.line_amount), 0), 2) as refunded,
               round(sum(coalesce(oi.commission_amount, oi.line_total * s.commission_rate / 100)) - coalesce(sum(r.commission), 0), 2) as commission,
               round(sum(coalesce(oi.tax_amount, 0)) - coalesce(sum(r.tax), 0), 2) as tax,
               round(sum(oi.line_total) - coalesce(sum(r.line_amount), 0) - (sum(coalesce(oi.commission_amount, oi.line_total * s.commission_rate / 100)) - coalesce(sum(r.commission), 0)) - (sum(coalesce(oi.supplier_discount, 0)) - coalesce(sum(r.funded), 0)), 2) as net
        from orders o
        join order_items oi on oi.order_id = o.id
        join product_variants pv on pv.id = oi.variant_id
        join products p on p.id = pv.product_id and p.store_id = p_store
        join stores s on s.id = p.store_id
        left join lateral (select sum(ri.line_amount) as line_amount, sum(ri.commission_reversed) as commission, sum(ri.supplier_discount_reversed) as funded, sum(ri.tax_reversed) as tax from order_refund_items ri where ri.order_item_id = oi.id) r on true
        where o.status = 'delivered'
          and (select max(h.created_at) from order_status_history h where h.order_id = o.id and h.status = 'delivered') >= v_from
          and (select max(h.created_at) from order_status_history h where h.order_id = o.id and h.status = 'delivered') < v_to
        group by o.id, o.order_number
      ) x), '[]'::jsonb),
    'payout_rows', coalesce((select jsonb_agg(jsonb_build_object('date', sp.created_at, 'amount', sp.amount, 'method', sp.method, 'reference', sp.reference) order by sp.created_at) from settlement_payouts sp where sp.store_id = p_store and sp.created_at >= v_from and sp.created_at < v_to), '[]'::jsonb)
  );
end;
$$;
grant execute on function supplier_statement(uuid, date, date, text) to authenticated;

-- What FasTrack earns in a period (admin, this market only).
create or replace function platform_earnings(p_from date, p_to date, p_tz text default 'UTC')
returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare
  v_from timestamptz := (p_from::timestamp at time zone p_tz);
  v_to timestamptz := ((p_to + 1)::timestamp at time zone p_tz);
  v_res jsonb;
begin
  if not is_admin() then
    raise exception 'Only admins can view earnings.';
  end if;
  with d as (
    select o.id, o.delivery_fee, o.discount, o.refunded_amount,
           (select max(h.created_at) from order_status_history h where h.order_id = o.id and h.status = 'delivered') as at
    from orders o where o.tenant_id = current_tenant_id() and o.status = 'delivered'
  ), w as (
    select d.*, (d.at at time zone p_tz)::date as day from d where d.at >= v_from and d.at < v_to
  ), li as (
    select w.day, w.id as order_id, oi.id as item_id, oi.line_total, coalesce(oi.commission_amount, 0) as commission, coalesce(oi.supplier_discount, 0) as funded, coalesce(oi.tax_amount, 0) as tax, p.store_id,
           coalesce((select sum(ri.line_amount) from order_refund_items ri where ri.order_item_id = oi.id), 0) as r_line,
           coalesce((select sum(ri.commission_reversed) from order_refund_items ri where ri.order_item_id = oi.id), 0) as r_comm,
           coalesce((select sum(ri.supplier_discount_reversed) from order_refund_items ri where ri.order_item_id = oi.id), 0) as r_fund,
           coalesce((select sum(ri.tax_reversed) from order_refund_items ri where ri.order_item_id = oi.id), 0) as r_tax
    from w join order_items oi on oi.order_id = w.id
    left join product_variants pv on pv.id = oi.variant_id
    left join products p on p.id = pv.product_id
  ), rider as (
    select (da.delivered_at at time zone p_tz)::date as day,
           sum(case when dp.pay_type = 'per_delivery' or dp.deliveries_earn_extra then coalesce(da.rider_pay, o.delivery_fee) else 0 end) as pay
    from delivery_assignments da
    join delivery_partners dp on dp.id = da.rider_id
    join orders o on o.id = da.order_id
    where o.tenant_id = current_tenant_id() and da.delivered_at >= v_from and da.delivered_at < v_to
    group by 1
  ), staff as (
    select (se.created_at at time zone p_tz)::date as day, sum(se.amount) as pay
    from rider_settlement_entries se
    where se.tenant_id = current_tenant_id() and se.kind in ('salary', 'bonus') and se.created_at >= v_from and se.created_at < v_to
    group by 1
  ), days as (
    select g::date as day from generate_series(p_from, p_to, interval '1 day') g
  ), per_day as (
    select days.day,
      coalesce((select sum(li.commission - li.r_comm) from li where li.day = days.day), 0) as commission,
      coalesce((select sum(w.delivery_fee) from w where w.day = days.day), 0) as delivery_fees,
      coalesce((select sum(w.discount) from w where w.day = days.day), 0) - coalesce((select sum(li.funded - li.r_fund) from li where li.day = days.day), 0) as fastrack_discounts,
      coalesce((select pay from rider where rider.day = days.day), 0) + coalesce((select pay from staff where staff.day = days.day), 0) as rider_cost
    from days
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'orders', (select count(*) from w),
    'gross_sales', coalesce((select round(sum(line_total), 2) from li), 0),
    'refunds', coalesce((select round(sum(r_line), 2) from li), 0),
    'tax_inside', coalesce((select round(sum(tax - r_tax), 2) from li), 0),
    'own_sales', coalesce((select round(sum(line_total - r_line), 2) from li where store_id is null), 0),
    'supplier_sales', coalesce((select round(sum(line_total - r_line), 2) from li where store_id is not null), 0),
    'commission', coalesce((select round(sum(commission), 2) from per_day), 0),
    'delivery_fees', coalesce((select round(sum(delivery_fees), 2) from per_day), 0),
    'delivery_fees_refunded', coalesce((select round(sum(r.delivery_amount), 2) from order_refunds r join w on w.id = r.order_id), 0),
    'fastrack_discounts', coalesce((select round(sum(fastrack_discounts), 2) from per_day), 0),
    'rider_cost', coalesce((select round(sum(rider_cost), 2) from per_day), 0),
    'series', (select coalesce(jsonb_agg(jsonb_build_object('date', day, 'commission', round(commission, 2), 'delivery_fees', round(delivery_fees, 2), 'discounts', round(fastrack_discounts, 2), 'rider_cost', round(rider_cost, 2)) order by day), '[]'::jsonb) from per_day),
    'top_suppliers', (select coalesce(jsonb_agg(x order by x.commission desc), '[]'::jsonb) from (
        select coalesce(s.name, 'FasTrack') as label, round(sum(li.line_total - li.r_line), 2) as sales, round(sum(li.commission - li.r_comm), 2) as commission
        from li left join stores s on s.id = li.store_id group by 1 order by 3 desc limit 6) x)
  ) into v_res;
  return v_res;
end;
$$;
grant execute on function platform_earnings(date, date, text) to authenticated;

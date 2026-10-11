-- Keeps every market (Saudi Arabia, India...) separate. These database functions ran with full access and did not look at the market,
-- so an admin of one country could see another country's suppliers, riders, settlements and more. Each now works on the signed-in
-- admin's own market only. Run the whole file in the Supabase SQL editor; safe to run more than once. No blank lines inside function bodies.

-- Supplier settlement ledger: only this market's suppliers.
create or replace function admin_settlement_overview()
returns table (store_id uuid, store_name text, store_status store_status, gross_sales numeric, commission_rate numeric, commission_amount numeric, net_earned numeric, paid_out numeric, balance_due numeric, delivered_order_count bigint)
language plpgsql security definer set search_path = public stable as $$
begin
  if not is_admin() then
    raise exception 'Only admins can view the settlement overview.';
  end if;
  return query
    select
      s.id, s.name, s.status,
      coalesce(sales.gross_sales, 0),
      case when coalesce(sales.gross_sales, 0) > 0 then round(sales.commission / sales.gross_sales * 100, 2) else s.commission_rate end,
      coalesce(sales.commission, 0),
      coalesce(sales.gross_sales, 0) - coalesce(sales.commission, 0) - coalesce(sales.funded, 0),
      coalesce(payouts.paid_out, 0),
      coalesce(sales.gross_sales, 0) - coalesce(sales.commission, 0) - coalesce(sales.funded, 0) - coalesce(payouts.paid_out, 0),
      coalesce(sales.order_count, 0)
    from stores s
    left join lateral (
      select sum(oi.line_total) as gross_sales,
             sum(coalesce(oi.commission_amount, oi.line_total * s.commission_rate / 100)) as commission,
             sum(coalesce(oi.supplier_discount, 0)) as funded,
             count(distinct oi.order_id) as order_count
      from order_items oi
      join product_variants pv on pv.id = oi.variant_id
      join products p on p.id = pv.product_id
      join orders o on o.id = oi.order_id
      where p.store_id = s.id and o.status = 'delivered'
    ) sales on true
    left join lateral (select sum(sp.amount) as paid_out from settlement_payouts sp where sp.store_id = s.id) payouts on true
    where s.tenant_id = current_tenant_id()
    order by (coalesce(sales.gross_sales, 0) - coalesce(sales.commission, 0) - coalesce(sales.funded, 0) - coalesce(payouts.paid_out, 0)) desc nulls last;
end;
$$;

-- One supplier's settlement: an admin can open only suppliers of their own market.
create or replace function store_settlement_summary(target_store_id uuid)
returns table (gross_sales numeric, commission_rate numeric, commission_amount numeric, net_earned numeric, paid_out numeric, balance_due numeric, delivered_order_count bigint)
language plpgsql security definer set search_path = public stable as $$
begin
  if not (exists (select 1 from stores s where s.id = target_store_id and s.owner_id = auth.uid())
          or (is_admin() and exists (select 1 from stores s where s.id = target_store_id and s.tenant_id = current_tenant_id()))) then
    raise exception 'Not authorized to view this store''s settlement.';
  end if;
  return query
    select
      coalesce(sales.gross_sales, 0),
      case when coalesce(sales.gross_sales, 0) > 0 then round(sales.commission / sales.gross_sales * 100, 2) else s.commission_rate end,
      coalesce(sales.commission, 0),
      coalesce(sales.gross_sales, 0) - coalesce(sales.commission, 0) - coalesce(sales.funded, 0),
      coalesce(payouts.paid_out, 0),
      coalesce(sales.gross_sales, 0) - coalesce(sales.commission, 0) - coalesce(sales.funded, 0) - coalesce(payouts.paid_out, 0),
      coalesce(sales.order_count, 0)
    from stores s
    left join lateral (
      select sum(oi.line_total) as gross_sales,
             sum(coalesce(oi.commission_amount, oi.line_total * s.commission_rate / 100)) as commission,
             sum(coalesce(oi.supplier_discount, 0)) as funded,
             count(distinct oi.order_id) as order_count
      from order_items oi
      join product_variants pv on pv.id = oi.variant_id
      join products p on p.id = pv.product_id
      join orders o on o.id = oi.order_id
      where p.store_id = s.id and o.status = 'delivered'
    ) sales on true
    left join lateral (select sum(sp.amount) as paid_out from settlement_payouts sp where sp.store_id = s.id) payouts on true
    where s.id = target_store_id;
end;
$$;

create or replace function store_settlement_orders(target_store_id uuid)
returns table (order_id uuid, order_number text, delivered_at timestamptz, item_count bigint, line_total numeric, commission_amount numeric, net_amount numeric)
language plpgsql security definer set search_path = public stable as $$
begin
  if not (exists (select 1 from stores s where s.id = target_store_id and s.owner_id = auth.uid())
          or (is_admin() and exists (select 1 from stores s where s.id = target_store_id and s.tenant_id = current_tenant_id()))) then
    raise exception 'Not authorized to view this store''s settlement.';
  end if;
  return query
    select
      o.id, o.order_number,
      (select max(h.created_at) from order_status_history h where h.order_id = o.id and h.status = 'delivered'),
      count(oi.id),
      sum(oi.line_total),
      sum(coalesce(oi.commission_amount, oi.line_total * s.commission_rate / 100)),
      sum(oi.line_total) - sum(coalesce(oi.commission_amount, oi.line_total * s.commission_rate / 100)) - sum(coalesce(oi.supplier_discount, 0))
    from order_items oi
    join product_variants pv on pv.id = oi.variant_id
    join products p on p.id = pv.product_id
    join stores s on s.id = p.store_id
    join orders o on o.id = oi.order_id
    where p.store_id = target_store_id and o.status = 'delivered'
    group by o.id, o.order_number
    order by max(o.updated_at) desc;
end;
$$;

-- Rider settlements: only this market's riders.
create or replace function admin_rider_settlement_overview()
returns table (rider_id uuid, rider_name text, rider_status rider_status, payout_method text, delivered_count bigint, earned numeric, cash_collected numeric, paid_out numeric, cash_deposited numeric, balance numeric, pay_type text, salary_bonus numeric, deductions numeric)
language plpgsql security definer set search_path = public stable as $$
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
      coalesce(d.deliv, 0) + coalesce(e.sal, 0),
      coalesce(d.cash, 0),
      coalesce(e.paid_out, 0),
      coalesce(e.deposited, 0),
      coalesce(d.deliv, 0) + coalesce(e.sal, 0) - coalesce(d.cash, 0) - coalesce(e.paid_out, 0) - coalesce(e.ded, 0) + coalesce(e.deposited, 0),
      dp.pay_type,
      coalesce(e.sal, 0),
      coalesce(e.ded, 0)
    from delivery_partners dp
    left join profiles pr on pr.id = dp.id
    left join lateral (
      select
        count(*) as cnt,
        sum(case when dp.pay_type = 'per_delivery' or dp.deliveries_earn_extra then coalesce(da.rider_pay, o.delivery_fee) else 0 end) as deliv,
        sum(case when p.method = 'cash_on_delivery' and p.status <> 'refunded' then o.total else 0 end) as cash
      from delivery_assignments da
      join orders o on o.id = da.order_id and o.status = 'delivered'
      left join payments p on p.order_id = o.id
      where da.rider_id = dp.id
    ) d on true
    left join lateral (
      select
        sum(se.amount) filter (where se.kind in ('payout', 'advance')) as paid_out,
        sum(se.amount) filter (where se.kind = 'cash_deposit') as deposited,
        sum(se.amount) filter (where se.kind in ('salary', 'bonus')) as sal,
        sum(se.amount) filter (where se.kind = 'deduction') as ded
      from rider_settlement_entries se where se.rider_id = dp.id
    ) e on true
    where dp.status in ('approved', 'suspended') and dp.tenant_id = current_tenant_id()
    order by abs(coalesce(d.deliv, 0) + coalesce(e.sal, 0) - coalesce(d.cash, 0) - coalesce(e.paid_out, 0) - coalesce(e.ded, 0) + coalesce(e.deposited, 0)) desc;
end;
$$;

create or replace function rider_settlement_orders(target_rider_id uuid)
returns table (order_id uuid, order_number text, delivered_at timestamp with time zone, delivery_fee numeric, order_total numeric, cash_collected numeric)
language plpgsql security definer set search_path = public stable as $$
begin
  if not ((is_admin() and exists (select 1 from delivery_partners x where x.id = target_rider_id and x.tenant_id = current_tenant_id())) or target_rider_id = auth.uid()) then
    raise exception 'Not authorized to view this rider''s settlement.';
  end if;
  return query
    select
      o.id,
      o.order_number,
      da.delivered_at,
      case when dp.pay_type = 'per_delivery' or dp.deliveries_earn_extra then coalesce(da.rider_pay, o.delivery_fee) else 0::numeric end,
      o.total,
      case when p.method = 'cash_on_delivery' and p.status <> 'refunded' then o.total else 0::numeric end
    from delivery_assignments da
    join delivery_partners dp on dp.id = da.rider_id
    join orders o on o.id = da.order_id and o.status = 'delivered'
    left join payments p on p.order_id = o.id
    where da.rider_id = target_rider_id
    order by da.delivered_at desc nulls last;
end;
$$;

create or replace function rider_settlement_summary(target_rider_id uuid)
returns table (delivered_count bigint, earned numeric, cash_collected numeric, paid_out numeric, cash_deposited numeric, balance numeric, salary_bonus numeric, deductions numeric)
language plpgsql security definer set search_path = public stable as $$
begin
  if not ((is_admin() and exists (select 1 from delivery_partners x where x.id = target_rider_id and x.tenant_id = current_tenant_id())) or target_rider_id = auth.uid()) then
    raise exception 'Not authorized to view this rider''s settlement.';
  end if;
  return query
    select
      d.cnt,
      d.deliv + coalesce(e.sal, 0),
      d.cash,
      coalesce(e.paid_out, 0),
      coalesce(e.deposited, 0),
      d.deliv + coalesce(e.sal, 0) - d.cash - coalesce(e.paid_out, 0) - coalesce(e.ded, 0) + coalesce(e.deposited, 0),
      coalesce(e.sal, 0),
      coalesce(e.ded, 0)
    from (
      select
        count(*) as cnt,
        coalesce(sum(case when dp.pay_type = 'per_delivery' or dp.deliveries_earn_extra then coalesce(da.rider_pay, o.delivery_fee) else 0 end), 0) as deliv,
        coalesce(sum(case when p.method = 'cash_on_delivery' and p.status <> 'refunded' then o.total else 0 end), 0) as cash
      from delivery_assignments da
      join delivery_partners dp on dp.id = da.rider_id
      join orders o on o.id = da.order_id and o.status = 'delivered'
      left join payments p on p.order_id = o.id
      where da.rider_id = target_rider_id
    ) d
    left join lateral (
      select
        sum(amount) filter (where kind in ('payout', 'advance')) as paid_out,
        sum(amount) filter (where kind = 'cash_deposit') as deposited,
        sum(amount) filter (where kind in ('salary', 'bonus')) as sal,
        sum(amount) filter (where kind = 'deduction') as ded
      from rider_settlement_entries where rider_id = target_rider_id
    ) e on true;
end;
$$;

-- Who gets "new order" alerts: only the admins of the market the order was placed in.
create or replace function admin_user_ids()
returns table (user_id uuid)
language sql stable security definer set search_path = public as $$
  select id from profiles where role = 'admin' and tenant_id = current_tenant_id();
$$;

create or replace function push_subscriptions_for_admins()
returns table (user_id uuid, endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = public as $$
  select ps.user_id, ps.endpoint, ps.p256dh, ps.auth
  from push_subscriptions ps
  join profiles p on p.id = ps.user_id
  where p.role = 'admin' and p.tenant_id = current_tenant_id();
$$;

-- Looking up people by email or id: only people of the admin's own market.
create or replace function admin_find_user_by_email(p_email text)
returns table (id uuid, full_name text, role text, has_store boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Only admins can look up users.';
  end if;
  return query
    select p.id, p.full_name, p.role::text,
           exists (select 1 from stores s where s.owner_id = p.id) as has_store
    from profiles p
    join auth.users u on u.id = p.id
    where lower(u.email) = lower(p_email) and p.tenant_id = current_tenant_id()
    limit 1;
end;
$$;

create or replace function admin_get_user_email(p_user_id uuid)
returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Only admins can look up users.';
  end if;
  return (select u.email from auth.users u join profiles p on p.id = u.id where u.id = p_user_id and p.tenant_id = current_tenant_id());
end;
$$;

-- Stock transfers: an admin can act only on their own market's transfers.
create or replace function send_stock_transfer(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_t stock_transfers%rowtype;
  r record;
  v_rows int;
begin
  select * into v_t from stock_transfers where id = p_id for update;
  if not found or v_t.tenant_id is distinct from current_tenant_id() then raise exception 'Transfer not found.'; end if;
  if not (is_admin() or my_staff_warehouse_id() = v_t.from_warehouse_id) then raise exception 'Only the sending location can send this.'; end if;
  if v_t.status <> 'draft' then raise exception 'This transfer was already sent.'; end if;
  for r in select i.variant_id, i.quantity, p.name from stock_transfer_items i join product_variants v on v.id = i.variant_id join products p on p.id = v.product_id where i.transfer_id = p_id loop
    update inventory set stock = stock - r.quantity, updated_at = now() where variant_id = r.variant_id and warehouse_id = v_t.from_warehouse_id and stock >= r.quantity;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then raise exception 'Not enough stock of % to send.', r.name; end if;
  end loop;
  update stock_transfers set status = 'in_transit', sent_at = now() where id = p_id;
end;
$$;

create or replace function receive_stock_transfer(p_id uuid, p_received jsonb default null::jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_t stock_transfers%rowtype;
  r record;
  v_qty numeric;
begin
  select * into v_t from stock_transfers where id = p_id for update;
  if not found or v_t.tenant_id is distinct from current_tenant_id() then raise exception 'Transfer not found.'; end if;
  if not (is_admin() or my_staff_warehouse_id() = v_t.to_warehouse_id) then raise exception 'Only the receiving location can receive this.'; end if;
  if v_t.status <> 'in_transit' then raise exception 'This transfer is not on its way.'; end if;
  for r in select i.id, i.variant_id, i.quantity from stock_transfer_items i where i.transfer_id = p_id loop
    v_qty := r.quantity;
    if p_received is not null and p_received ? r.id::text then v_qty := least((p_received ->> r.id::text)::numeric, r.quantity); end if;
    if v_qty < 0 then v_qty := 0; end if;
    update stock_transfer_items set received_quantity = v_qty where id = r.id;
    insert into inventory (variant_id, warehouse_id, stock) values (r.variant_id, v_t.to_warehouse_id, v_qty)
      on conflict (variant_id, warehouse_id) do update set stock = inventory.stock + excluded.stock, updated_at = now();
  end loop;
  update stock_transfers set status = 'received', received_at = now() where id = p_id;
end;
$$;

create or replace function cancel_stock_transfer(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_t stock_transfers%rowtype;
  r record;
begin
  select * into v_t from stock_transfers where id = p_id for update;
  if not found or v_t.tenant_id is distinct from current_tenant_id() then raise exception 'Transfer not found.'; end if;
  if not (is_admin() or my_staff_warehouse_id() = v_t.from_warehouse_id) then raise exception 'Only the sending location can cancel this.'; end if;
  if v_t.status not in ('draft', 'in_transit') then raise exception 'This transfer can no longer be cancelled.'; end if;
  if v_t.status = 'in_transit' then
    for r in select i.variant_id, i.quantity from stock_transfer_items i where i.transfer_id = p_id loop
      insert into inventory (variant_id, warehouse_id, stock) values (r.variant_id, v_t.from_warehouse_id, r.quantity)
        on conflict (variant_id, warehouse_id) do update set stock = inventory.stock + excluded.stock, updated_at = now();
    end loop;
  end if;
  update stock_transfers set status = 'cancelled' where id = p_id;
end;
$$;

-- Tables with no market column of their own: an admin reaches only their market's rows.
drop policy if exists "admins see dispatch alerts" on dispatch_alerts;
create policy "admins see dispatch alerts" on dispatch_alerts for select
  using ((select is_admin()) and exists (select 1 from orders o where o.id = dispatch_alerts.order_id and o.tenant_id = (select current_tenant_id())));

drop policy if exists "users manage own addresses" on addresses;
create policy "users manage own addresses" on addresses for all
  using (
    (select auth.uid()) = user_id
    or ((select is_admin()) and exists (select 1 from profiles p where p.id = addresses.user_id and p.tenant_id = (select current_tenant_id())))
  );

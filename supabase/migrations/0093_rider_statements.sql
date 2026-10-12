-- Rider settlement engine upgrade:
--  * a refunded cash-on-delivery order no longer drops out of what the rider collected: the rider took that cash at the door and must still hand it in
--    (the refund to the customer is paid separately), so the balance stays honest.
--  * rider_statement(): a period statement for one rider with opening balance, delivery pay, salary and bonus, cash collected, cash handed in,
--    payouts and advances, deductions, and closing balance.
-- Run in the Supabase SQL editor. Safe to run more than once. No blank lines inside function bodies.

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
      coalesce(pr.full_name, '-'),
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
        sum(case when p.method = 'cash_on_delivery' then o.total else 0 end) as cash
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
      case when p.method = 'cash_on_delivery' then o.total else 0::numeric end
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
        coalesce(sum(case when p.method = 'cash_on_delivery' then o.total else 0 end), 0) as cash
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

-- A rider's period statement. Older deliveries without a recorded delivery time use the time the order was marked delivered.
-- Balance = delivery pay + salary and bonus - cash collected - payouts and advances - deductions + cash handed in
-- (positive: FasTrack owes the rider; negative: the rider owes FasTrack).
create or replace function rider_statement(p_rider uuid, p_from date, p_to date, p_tz text default 'UTC')
returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare
  v_from timestamptz := (p_from::timestamp at time zone p_tz);
  v_to timestamptz := ((p_to + 1)::timestamp at time zone p_tz);
  rp delivery_partners%rowtype;
  v_name text;
  v_open_deliv numeric; v_open_cash numeric; v_open_entries numeric;
  v_deliv numeric; v_cash numeric; v_count bigint;
  v_salary numeric; v_bonus numeric; v_paid numeric; v_ded numeric; v_dep numeric;
  v_open numeric; v_close numeric;
begin
  if not ((is_admin() and exists (select 1 from delivery_partners x where x.id = p_rider and x.tenant_id = current_tenant_id())) or p_rider = auth.uid()) then
    raise exception 'Not authorized to view this statement.';
  end if;
  select * into rp from delivery_partners where id = p_rider;
  if not found then
    raise exception 'Rider not found.';
  end if;
  select full_name into v_name from profiles where id = p_rider;
  select
    coalesce(sum(case when rp.pay_type = 'per_delivery' or rp.deliveries_earn_extra then coalesce(da.rider_pay, o.delivery_fee) else 0 end), 0),
    coalesce(sum(case when pay.method = 'cash_on_delivery' then o.total else 0 end), 0)
  into v_open_deliv, v_open_cash
  from delivery_assignments da join orders o on o.id = da.order_id and o.status = 'delivered' left join payments pay on pay.order_id = o.id
  where da.rider_id = p_rider and coalesce(da.delivered_at, (select max(h.created_at) from order_status_history h where h.order_id = o.id and h.status = 'delivered'), o.created_at) < v_from;
  select
    coalesce(sum(case when rp.pay_type = 'per_delivery' or rp.deliveries_earn_extra then coalesce(da.rider_pay, o.delivery_fee) else 0 end), 0),
    coalesce(sum(case when pay.method = 'cash_on_delivery' then o.total else 0 end), 0),
    count(*)
  into v_deliv, v_cash, v_count
  from delivery_assignments da join orders o on o.id = da.order_id and o.status = 'delivered' left join payments pay on pay.order_id = o.id
  where da.rider_id = p_rider and coalesce(da.delivered_at, (select max(h.created_at) from order_status_history h where h.order_id = o.id and h.status = 'delivered'), o.created_at) >= v_from and coalesce(da.delivered_at, (select max(h.created_at) from order_status_history h where h.order_id = o.id and h.status = 'delivered'), o.created_at) < v_to;
  select
    coalesce(sum(case when se.kind in ('salary', 'bonus', 'cash_deposit') then se.amount else -se.amount end) filter (where se.created_at < v_from), 0),
    coalesce(sum(se.amount) filter (where se.kind = 'salary' and se.created_at >= v_from and se.created_at < v_to), 0),
    coalesce(sum(se.amount) filter (where se.kind = 'bonus' and se.created_at >= v_from and se.created_at < v_to), 0),
    coalesce(sum(se.amount) filter (where se.kind in ('payout', 'advance') and se.created_at >= v_from and se.created_at < v_to), 0),
    coalesce(sum(se.amount) filter (where se.kind = 'deduction' and se.created_at >= v_from and se.created_at < v_to), 0),
    coalesce(sum(se.amount) filter (where se.kind = 'cash_deposit' and se.created_at >= v_from and se.created_at < v_to), 0)
  into v_open_entries, v_salary, v_bonus, v_paid, v_ded, v_dep
  from rider_settlement_entries se where se.rider_id = p_rider;
  v_open := v_open_deliv - v_open_cash + v_open_entries;
  v_close := v_open + v_deliv + v_salary + v_bonus - v_cash - v_paid - v_ded + v_dep;
  return jsonb_build_object(
    'rider', jsonb_build_object('name', coalesce(v_name, '-'), 'pay_type', rp.pay_type, 'payout_method', rp.payout_method),
    'from', p_from, 'to', p_to,
    'opening_balance', round(v_open, 2),
    'deliveries', v_count,
    'delivery_pay', round(v_deliv, 2),
    'salary', round(v_salary, 2),
    'bonus', round(v_bonus, 2),
    'cash_collected', round(v_cash, 2),
    'cash_handed_in', round(v_dep, 2),
    'paid_out', round(v_paid, 2),
    'deductions', round(v_ded, 2),
    'closing_balance', round(v_close, 2),
    'delivery_rows', coalesce((
      select jsonb_agg(jsonb_build_object('order_number', o.order_number, 'delivered_at', coalesce(da.delivered_at, (select max(h.created_at) from order_status_history h where h.order_id = o.id and h.status = 'delivered'), o.created_at),
        'pay', case when rp.pay_type = 'per_delivery' or rp.deliveries_earn_extra then coalesce(da.rider_pay, o.delivery_fee) else 0 end,
        'cash', case when pay.method = 'cash_on_delivery' then o.total else 0 end) order by coalesce(da.delivered_at, (select max(h.created_at) from order_status_history h where h.order_id = o.id and h.status = 'delivered'), o.created_at))
      from delivery_assignments da join orders o on o.id = da.order_id and o.status = 'delivered' left join payments pay on pay.order_id = o.id
      where da.rider_id = p_rider and coalesce(da.delivered_at, (select max(h.created_at) from order_status_history h where h.order_id = o.id and h.status = 'delivered'), o.created_at) >= v_from and coalesce(da.delivered_at, (select max(h.created_at) from order_status_history h where h.order_id = o.id and h.status = 'delivered'), o.created_at) < v_to), '[]'::jsonb),
    'entry_rows', coalesce((
      select jsonb_agg(jsonb_build_object('date', se.created_at, 'kind', se.kind, 'amount', se.amount, 'method', se.method, 'reference', se.reference, 'note', se.note) order by se.created_at)
      from rider_settlement_entries se where se.rider_id = p_rider and se.created_at >= v_from and se.created_at < v_to), '[]'::jsonb)
  );
end;
$$;
grant execute on function rider_statement(uuid, date, date, text) to authenticated;

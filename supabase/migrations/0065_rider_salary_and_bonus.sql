-- Rider pay types, salary / bonus / advance / deduction entries and a daily-target bonus.
--   per_delivery  (default)  the rider earns the per-delivery pay on each delivery (0064).
--   salary                   a fixed monthly salary (an employee). Deliveries add nothing, unless deliveries_earn_extra is switched on for that rider.
-- Salary, bonus, advance and deduction are recorded as ledger entries (rider_settlement_entries):
--   salary, bonus      add to what FasTrack owes the rider
--   payout, advance    money FasTrack has paid the rider (reduce the balance)
--   deduction          a fine or other deduction (reduces the balance, nothing paid)
--   cash_deposit       cash the rider handed in
-- Run the whole file in the Supabase SQL editor. No blank lines inside function bodies.

alter table delivery_partners add column if not exists pay_type text not null default 'per_delivery';
alter table delivery_partners drop constraint if exists delivery_partners_pay_type_check;
alter table delivery_partners add constraint delivery_partners_pay_type_check check (pay_type in ('per_delivery', 'salary'));
alter table delivery_partners add column if not exists monthly_salary numeric check (monthly_salary is null or monthly_salary >= 0);
alter table delivery_partners add column if not exists deliveries_earn_extra boolean not null default false;

alter table company_settings add column if not exists rider_daily_target int check (rider_daily_target is null or rider_daily_target > 0);
alter table company_settings add column if not exists rider_daily_bonus numeric not null default 0 check (rider_daily_bonus >= 0);

alter table rider_settlement_entries drop constraint if exists rider_settlement_entries_kind_check;
alter table rider_settlement_entries add constraint rider_settlement_entries_kind_check
  check (kind in ('payout', 'cash_deposit', 'salary', 'bonus', 'advance', 'deduction'));
-- A daily-target bonus is paid once per rider per day (its reference is the day).
create unique index if not exists rider_bonus_once_per_day on rider_settlement_entries (rider_id, reference) where kind = 'bonus';

-- Daily target bonus: when a rider's delivery count for the day (market time) reaches the target, add the bonus once.
create or replace function award_daily_target_bonus()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_ok boolean;
  v_tenant uuid;
  v_target int;
  v_bonus numeric;
  v_tz text;
  v_day date;
  v_count int;
begin
  if new.delivered_at is null or old.delivered_at is not null then return new; end if;
  select (dp.pay_type = 'per_delivery' or dp.deliveries_earn_extra), p.tenant_id into v_ok, v_tenant
    from delivery_partners dp join profiles p on p.id = dp.id where dp.id = new.rider_id;
  if not coalesce(v_ok, false) then return new; end if;
  select cs.rider_daily_target, cs.rider_daily_bonus into v_target, v_bonus from company_settings cs where cs.tenant_id = v_tenant limit 1;
  if v_target is null or coalesce(v_bonus, 0) <= 0 then return new; end if;
  select case when t.country_code = 'IN' then 'Asia/Kolkata' else 'Asia/Riyadh' end into v_tz from tenants t where t.id = v_tenant;
  v_tz := coalesce(v_tz, 'Asia/Riyadh');
  v_day := (new.delivered_at at time zone v_tz)::date;
  select count(*) into v_count from delivery_assignments da
    where da.rider_id = new.rider_id and da.delivered_at is not null and (da.delivered_at at time zone v_tz)::date = v_day;
  if v_count >= v_target then
    insert into rider_settlement_entries (tenant_id, rider_id, kind, amount, method, reference, note)
      values (v_tenant, new.rider_id, 'bonus', v_bonus, 'other', v_day::text, 'Daily target: ' || v_target || ' deliveries')
      on conflict (rider_id, reference) where kind = 'bonus' do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_daily_target_bonus on delivery_assignments;
create trigger trg_daily_target_bonus after update of delivered_at on delivery_assignments for each row execute function award_daily_target_bonus();

-- Settlement: delivery pay (only for riders whose type earns it) + salary and bonus entries, minus cash held, payouts, advances and deductions.
drop function if exists rider_settlement_summary(uuid);
create function rider_settlement_summary(target_rider_id uuid)
returns table (
  delivered_count bigint,
  earned numeric,
  cash_collected numeric,
  paid_out numeric,
  cash_deposited numeric,
  balance numeric,
  salary_bonus numeric,
  deductions numeric
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
grant execute on function rider_settlement_summary(uuid) to authenticated;

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
grant execute on function rider_settlement_orders(uuid) to authenticated;

drop function if exists admin_rider_settlement_overview();
create function admin_rider_settlement_overview()
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
  balance numeric,
  pay_type text,
  salary_bonus numeric,
  deductions numeric
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
    where dp.status in ('approved', 'suspended')
    order by abs(coalesce(d.deliv, 0) + coalesce(e.sal, 0) - coalesce(d.cash, 0) - coalesce(e.paid_out, 0) - coalesce(e.ded, 0) + coalesce(e.deposited, 0)) desc;
end;
$$;
grant execute on function admin_rider_settlement_overview() to authenticated;

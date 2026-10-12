-- Flexible rider pay options, set per rider by the admin:
--  * hide_earnings        the rider's app shows deliveries, history, ratings and the cash to hand in, but no earned amounts, balance, salary or statement.
--                         The admin sees everything as before.
--  * daily_bonus_override null = follow the pay type (per-delivery riders get the daily-target bonus, salaried riders do not);
--                         true = always eligible; false = never.
--  * auto_salary / salary_day   a salaried rider's monthly salary is added by itself on that day (1 to 28) of each month, once per month.
-- Run in the Supabase SQL editor. Safe to run more than once. No blank lines inside function bodies.

alter table delivery_partners add column if not exists hide_earnings boolean not null default false;
alter table delivery_partners add column if not exists daily_bonus_override boolean;
alter table delivery_partners add column if not exists auto_salary boolean not null default false;
alter table delivery_partners add column if not exists salary_day int not null default 1;
alter table delivery_partners drop constraint if exists delivery_partners_salary_day_check;
alter table delivery_partners add constraint delivery_partners_salary_day_check check (salary_day between 1 and 28);

create unique index if not exists rider_salary_once_per_month on rider_settlement_entries (rider_id, reference) where kind = 'salary' and reference like 'salary:%';

-- Daily target bonus: now respects the per-rider override.
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
  select coalesce(dp.daily_bonus_override, dp.pay_type = 'per_delivery' or dp.deliveries_earn_extra), p.tenant_id into v_ok, v_tenant
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

-- Adds this month's salary for every salaried rider of the admin's market who has automatic salary on and whose salary day has come.
-- Safe to call as often as you like: a rider gets one salary entry per month. Returns how many were added.
create or replace function post_due_salaries()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_tz text;
  v_now timestamp;
  v_added integer := 0;
  r record;
  n integer;
begin
  if not is_admin() then
    return 0;
  end if;
  select case when t.country_code = 'IN' then 'Asia/Kolkata' else 'Asia/Riyadh' end into v_tz from tenants t where t.id = current_tenant_id();
  v_tz := coalesce(v_tz, 'Asia/Riyadh');
  v_now := now() at time zone v_tz;
  for r in
    select dp.id, dp.monthly_salary from delivery_partners dp
    where dp.tenant_id = current_tenant_id() and dp.pay_type = 'salary' and dp.auto_salary and coalesce(dp.monthly_salary, 0) > 0
      and dp.status in ('approved', 'suspended') and extract(day from v_now) >= dp.salary_day
  loop
    insert into rider_settlement_entries (tenant_id, rider_id, kind, amount, method, reference, note)
      values (current_tenant_id(), r.id, 'salary', r.monthly_salary, 'other', 'salary:' || to_char(v_now, 'YYYY-MM'), 'Monthly salary ' || to_char(v_now, 'Mon YYYY'))
      on conflict (rider_id, reference) where kind = 'salary' and reference like 'salary:%' do nothing;
    get diagnostics n = row_count;
    v_added := v_added + n;
  end loop;
  return v_added;
end;
$$;
revoke all on function post_due_salaries() from public;
grant execute on function post_due_salaries() to authenticated;

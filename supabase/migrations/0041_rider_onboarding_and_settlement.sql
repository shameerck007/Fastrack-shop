-- Rider onboarding like Keeta (identity, vehicle, optional bank payout) and a
-- rider settlement ledger: what FasTrack owes each rider (delivery fees)
-- against cash they collected on cash-on-delivery orders and money paid /
-- handed in, so admin always knows who owes whom.

alter table delivery_partners
  add column if not exists id_type text check (id_type in ('national_id', 'iqama')),
  add column if not exists id_number text,
  add column if not exists nationality text,
  add column if not exists date_of_birth date,
  add column if not exists city text,
  add column if not exists id_front_path text,
  add column if not exists id_back_path text,
  add column if not exists selfie_path text,
  add column if not exists license_expiry date,
  add column if not exists vehicle_plate text,
  add column if not exists vehicle_make_model text,
  add column if not exists vehicle_year int,
  add column if not exists registration_path text,
  add column if not exists registration_expiry date,
  add column if not exists insurance_path text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists payout_method text not null default 'cash' check (payout_method in ('bank', 'cash')),
  add column if not exists bank_name text,
  add column if not exists bank_iban text,
  add column if not exists bank_account_holder text,
  add column if not exists terms_accepted_at timestamptz;

-- One ledger row per money movement between FasTrack and a rider.
--   payout        FasTrack paid the rider (bank transfer or cash)
--   cash_deposit  the rider handed in cash collected from customers
create table if not exists rider_settlement_entries (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references delivery_partners(id) on delete cascade,
  kind text not null check (kind in ('payout', 'cash_deposit')),
  amount numeric not null check (amount > 0),
  method text not null default 'cash',
  reference text,
  note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists rider_settlement_entries_idx on rider_settlement_entries(rider_id, created_at desc);

alter table rider_settlement_entries enable row level security;
create policy "admins manage rider settlement entries" on rider_settlement_entries for all
  using (is_admin()) with check (is_admin());
create policy "riders view own settlement entries" on rider_settlement_entries for select
  using (rider_id = auth.uid());

-- earned      = delivery fees on delivered orders
-- cash_held   = order totals collected in cash on delivered COD orders
-- balance     = earned - cash_held - payouts + cash_deposits
--               (positive: FasTrack owes the rider; negative: the rider owes FasTrack)
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
        coalesce(sum(o.delivery_fee), 0) as earned,
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
grant execute on function rider_settlement_summary(uuid) to authenticated;

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
        sum(o.delivery_fee) as earned,
        sum(case when p.method = 'cash_on_delivery' and p.status <> 'refunded' then o.total else 0 end) as cash
      from delivery_assignments da
      join orders o on o.id = da.order_id and o.status = 'delivered'
      left join payments p on p.order_id = o.id
      where da.rider_id = dp.id
    ) d on true
    left join lateral (
      select
        sum(amount) filter (where kind = 'payout') as paid_out,
        sum(amount) filter (where kind = 'cash_deposit') as deposited
      from rider_settlement_entries where rider_id = dp.id
    ) e on true
    where dp.status in ('approved', 'suspended')
    order by abs(coalesce(d.earned, 0) - coalesce(d.cash, 0) - coalesce(e.paid_out, 0) + coalesce(e.deposited, 0)) desc;
end;
$$;
grant execute on function admin_rider_settlement_overview() to authenticated;

-- Order-level breakdown behind a rider's balance.
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
      o.delivery_fee,
      o.total,
      case when p.method = 'cash_on_delivery' and p.status <> 'refunded' then o.total else 0::numeric end
    from delivery_assignments da
    join orders o on o.id = da.order_id and o.status = 'delivered'
    left join payments p on p.order_id = o.id
    where da.rider_id = target_rider_id
    order by da.delivered_at desc nulls last;
end;
$$;
grant execute on function rider_settlement_orders(uuid) to authenticated;

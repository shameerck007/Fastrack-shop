-- Fix for admin_rider_settlement_overview() from 0041: it failed with
-- "column reference rider_id is ambiguous" (an output column and a table column shared the
-- name inside the function). Every column is now qualified with its table alias.
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
        sum(se.amount) filter (where se.kind = 'payout') as paid_out,
        sum(se.amount) filter (where se.kind = 'cash_deposit') as deposited
      from rider_settlement_entries se where se.rider_id = dp.id
    ) e on true
    where dp.status in ('approved', 'suspended')
    order by abs(coalesce(d.earned, 0) - coalesce(d.cash, 0) - coalesce(e.paid_out, 0) + coalesce(e.deposited, 0)) desc;
end;
$$;
grant execute on function admin_rider_settlement_overview() to authenticated;

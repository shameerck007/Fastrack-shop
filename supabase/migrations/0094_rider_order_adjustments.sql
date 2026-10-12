-- Rider pay when an order goes wrong.
--  * Failed delivery: an order that was cancelled after a rider was assigned. The admin can pay the rider (up to the pay for that order) for the trip.
--    It is recorded as a bonus entry with the reference "failed:<order id>", so the rider's statement and the platform earnings pick it up with no other change.
--  * Refund after delivery: the admin can deduct from the rider (up to the refunded amount), for example when the rider damaged the goods.
--    It is recorded as a deduction with the reference "refund:<order id>". Nothing is taken from a rider automatically.
-- Each can be recorded once per order.
-- Run in the Supabase SQL editor. Safe to run more than once. No blank lines inside function bodies.

create unique index if not exists rider_deduction_once_per_refund on rider_settlement_entries (rider_id, reference) where kind = 'deduction' and reference like 'refund:%';

create or replace function admin_rider_order_adjustment(p_order uuid, p_kind text, p_amount numeric, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o orders%rowtype;
  da delivery_assignments%rowtype;
  v_pay numeric;
begin
  if not is_admin() then
    raise exception 'Only admins can change rider pay.';
  end if;
  select * into o from orders where id = p_order and tenant_id = current_tenant_id();
  if not found then
    raise exception 'Order not found.';
  end if;
  select * into da from delivery_assignments where order_id = p_order;
  if not found then
    raise exception 'No rider was assigned to this order.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter an amount greater than zero.';
  end if;
  v_pay := coalesce(da.rider_pay, o.delivery_fee);
  if p_kind = 'failed_delivery' then
    if o.status <> 'cancelled' then
      raise exception 'Only a cancelled order can be paid as a failed delivery.';
    end if;
    if p_amount > v_pay then
      raise exception 'The amount cannot be more than the rider pay for this order (%).', v_pay;
    end if;
    begin
      insert into rider_settlement_entries (tenant_id, rider_id, kind, amount, method, reference, note, created_by)
      values (o.tenant_id, da.rider_id, 'bonus', p_amount, 'other', 'failed:' || o.id::text, coalesce(nullif(trim(p_note), ''), 'Failed delivery, order #' || o.order_number), auth.uid());
    exception when unique_violation then
      raise exception 'The rider has already been paid for this failed delivery.';
    end;
  elsif p_kind = 'refund_clawback' then
    if o.status <> 'delivered' or coalesce(o.refunded_amount, 0) <= 0 then
      raise exception 'Only a delivered order that has been refunded can be deducted from the rider.';
    end if;
    if p_amount > o.refunded_amount then
      raise exception 'The amount cannot be more than what was refunded (%).', o.refunded_amount;
    end if;
    begin
      insert into rider_settlement_entries (tenant_id, rider_id, kind, amount, method, reference, note, created_by)
      values (o.tenant_id, da.rider_id, 'deduction', p_amount, 'other', 'refund:' || o.id::text, coalesce(nullif(trim(p_note), ''), 'Refund on order #' || o.order_number), auth.uid());
    exception when unique_violation then
      raise exception 'A deduction has already been recorded for this refund.';
    end;
  else
    raise exception 'Choose what to record.';
  end if;
  return jsonb_build_object('rider_id', da.rider_id, 'order_number', o.order_number, 'amount', p_amount, 'kind', p_kind);
end;
$$;
revoke all on function admin_rider_order_adjustment(uuid, text, numeric, text) from public;
grant execute on function admin_rider_order_adjustment(uuid, text, numeric, text) to authenticated;

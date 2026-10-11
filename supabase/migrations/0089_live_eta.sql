-- Live arrival estimate: while a rider is on an order, the system re-works the arrival time from the rider's real position every
-- few seconds and saves it on the order. The customer's tracking screen, notifications and the admin all read the same figure,
-- and the customer gets a "running a little late" alert (once) if it slips well past the time promised at checkout.
-- Run in the Supabase SQL editor. Safe to run more than once. No blank lines inside function bodies.

alter table orders add column if not exists live_eta_at timestamptz;
alter table orders add column if not exists live_eta_km numeric;
alter table orders add column if not exists live_eta_updated_at timestamptz;
alter table orders add column if not exists late_notified_at timestamptz;

-- Called by the app as the rider moves. Only the rider assigned to the order (or an admin) may save an estimate.
-- Returns whether the customer should now be told the order is running late (and marks that it was told, so it happens once).
create or replace function rider_update_live_eta(p_order uuid, p_eta timestamptz, p_km numeric)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_promised timestamptz;
  v_user uuid;
  v_notified timestamptz;
  v_late boolean := false;
begin
  if not (is_admin() or is_assigned_rider(p_order)) then
    raise exception 'This order is not assigned to you.';
  end if;
  update orders set live_eta_at = p_eta, live_eta_km = round(p_km, 2), live_eta_updated_at = now()
    where id = p_order and status::text in ('rider_assigned', 'out_for_delivery')
    returning estimated_delivery_at, user_id, late_notified_at into v_promised, v_user, v_notified;
  if not found then
    return jsonb_build_object('late', false);
  end if;
  if v_promised is not null and v_notified is null and p_eta > v_promised + interval '10 minutes' then
    update orders set late_notified_at = now() where id = p_order;
    v_late := true;
  end if;
  return jsonb_build_object('late', v_late, 'user_id', v_user);
end;
$$;
grant execute on function rider_update_live_eta(uuid, timestamptz, numeric) to authenticated;

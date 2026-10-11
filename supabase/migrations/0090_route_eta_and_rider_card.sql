-- 1. A rider carrying several orders (a Standard route, or a batch): each order's live arrival time now counts the drops before it,
--    and the order remembers how many stops come before it (live_eta_stops: 1 = this order is next).
-- 2. The rider card a customer sees on the tracking screen: rating, number of ratings and deliveries, vehicle and the last digits of the plate.
-- Run in the Supabase SQL editor. Safe to run more than once. No blank lines inside function bodies.

alter table orders add column if not exists live_eta_stops int;

drop function if exists rider_update_live_eta(uuid, timestamptz, numeric);
create or replace function rider_update_live_eta(p_order uuid, p_eta timestamptz, p_km numeric, p_stops int default 1)
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
  update orders set live_eta_at = p_eta, live_eta_km = round(p_km, 2), live_eta_stops = greatest(1, coalesce(p_stops, 1)), live_eta_updated_at = now()
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
grant execute on function rider_update_live_eta(uuid, timestamptz, numeric, int) to authenticated;

create or replace function order_rider_card(p_order uuid)
returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare
  r record;
begin
  if not (is_admin() or owns_order(p_order) or is_assigned_rider(p_order)) then
    return null;
  end if;
  select dp.id, dp.rating, dp.vehicle_type::text as vehicle_type, dp.vehicle_make_model, dp.vehicle_plate into r
    from delivery_assignments da join delivery_partners dp on dp.id = da.rider_id
    where da.order_id = p_order limit 1;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'rating', r.rating,
    'rating_count', (select count(*) from order_ratings x where x.rider_id = r.id),
    'deliveries', (select count(*) from delivery_assignments d where d.rider_id = r.id and d.delivered_at is not null),
    'vehicle_type', r.vehicle_type,
    'vehicle', r.vehicle_make_model,
    'plate_end', case when r.vehicle_plate is null or length(r.vehicle_plate) < 3 then null else right(r.vehicle_plate, 3) end
  );
end;
$$;
grant execute on function order_rider_card(uuid) to authenticated;

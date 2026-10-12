-- Pickup code: the store (warehouse or supplier) sees a 4-digit code for each order; the rider enters it at pickup to prove they are collecting the right parcel
-- from the right place, with no camera needed. Together with the parcel label scan, either one confirms a pickup.
--  * The code is worked out from the order id and a private salt, so it is never stored on the order and the rider's app cannot read it.
--  * Only the store that fills the order (its warehouse staff, its supplier) and admins can ask for the code.
--  * The assigned rider can only check a code. After 5 wrong tries the order is locked for code entry (the label scan and admin still work).
-- Run in the Supabase SQL editor. Safe to run more than once. No blank lines inside function bodies.

create table if not exists app_secrets (
  name text primary key,
  value text not null
);
alter table app_secrets enable row level security;
revoke all on app_secrets from anon, authenticated;
insert into app_secrets (name, value) values ('pickup_code_salt', replace(gen_random_uuid()::text, '-', '')) on conflict (name) do nothing;

create table if not exists order_pickup_attempts (
  order_id uuid primary key references orders(id) on delete cascade,
  failures int not null default 0
);
alter table order_pickup_attempts enable row level security;
revoke all on order_pickup_attempts from anon, authenticated;

create or replace function pickup_code_value(p_order uuid)
returns text
language sql stable security definer set search_path = public as $$
  select lpad((((('x' || substr(md5((select value from app_secrets where name = 'pickup_code_salt') || p_order::text), 1, 8))::bit(32)::bigint) % 10000))::text, 4, '0');
$$;
revoke all on function pickup_code_value(uuid) from public, anon, authenticated;

-- The code, for the people who fill the order.
create or replace function pickup_code_for(p_order uuid)
returns text
language plpgsql stable security definer set search_path = public as $$
declare
  o orders%rowtype;
begin
  select * into o from orders where id = p_order;
  if not found then
    return null;
  end if;
  if not coalesce((is_admin() and o.tenant_id = current_tenant_id()) or coalesce(o.warehouse_id = my_staff_warehouse_id(), false) or order_has_my_store_item(p_order), false) then
    raise exception 'Only the store filling this order can see its pickup code.';
  end if;
  return pickup_code_value(p_order);
end;
$$;
revoke all on function pickup_code_for(uuid) from public;
grant execute on function pickup_code_for(uuid) to authenticated;

-- The rider (or an admin) checks a code. Returns true or false; raises only when the order is locked.
create or replace function verify_pickup_code(p_order uuid, p_code text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_fail int;
begin
  if not (is_assigned_rider(p_order) or is_admin()) then
    raise exception 'Only the assigned rider can check the pickup code.';
  end if;
  select failures into v_fail from order_pickup_attempts where order_id = p_order;
  if coalesce(v_fail, 0) >= 5 then
    raise exception 'Too many wrong codes. Scan the parcel label, or ask the store or FasTrack to help.';
  end if;
  if regexp_replace(coalesce(p_code, ''), '\s', '', 'g') = pickup_code_value(p_order) then
    delete from order_pickup_attempts where order_id = p_order;
    return true;
  end if;
  insert into order_pickup_attempts (order_id, failures) values (p_order, 1)
    on conflict (order_id) do update set failures = order_pickup_attempts.failures + 1;
  return false;
end;
$$;
revoke all on function verify_pickup_code(uuid, text) from public;
grant execute on function verify_pickup_code(uuid, text) to authenticated;

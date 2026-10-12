-- Returns, item by item, the way Amazon and Noon do it.
--  * A customer returns an individual item (and quantity) of a delivered order, inside a return window, with a reason and optional photos.
--    Nothing is raised against the whole order.
--  * Window: set per category (0 = cannot be returned; empty = the market default, 7 days). A sub-category follows its main category when empty.
--  * Damaged, wrong or incomplete items with a photo are approved at once (switchable). Everything else waits for an admin.
--  * Approved returns are collected by a rider, who confirms with the customer's 4-digit code, and the item is refunded at that moment
--    (an "express" refund). Low-value items can be approved as "keep it" and refunded straight away.
--  * Every refund goes through the same itemised refund as before, so the supplier payout, commission, discount and tax reverse for that item only.
-- Run in the Supabase SQL editor. Safe to run more than once. No blank lines inside function bodies.

alter table categories add column if not exists return_window_days int check (return_window_days is null or return_window_days between 0 and 90);
alter table company_settings add column if not exists default_return_window_days int not null default 7 check (default_return_window_days between 0 and 90);
alter table company_settings add column if not exists return_auto_approve boolean not null default true;

-- The refund logic, shared by the admin refund and by returns. The caller has already checked who may do it.
create or replace function refund_order_core(p_order uuid, p_items jsonb, p_delivery boolean, p_reason text, p_by uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o orders%rowtype;
  it jsonb;
  oi order_items%rowtype;
  v_qty numeric;
  v_done numeric;
  v_ratio numeric;
  v_refund uuid;
  v_total numeric := 0;
  v_delivery numeric := 0;
  v_amount numeric;
begin
  select * into o from orders where id = p_order;
  if not found then
    raise exception 'Order not found.';
  end if;
  if o.status::text = 'cancelled' then
    raise exception 'A cancelled order has nothing to refund.';
  end if;
  if p_delivery and o.delivery_fee > 0 and not exists (select 1 from order_refunds r where r.order_id = o.id and r.delivery_amount > 0) then
    v_delivery := o.delivery_fee;
  end if;
  if (p_items is null or jsonb_array_length(p_items) = 0) and v_delivery = 0 then
    raise exception 'Choose what to refund.';
  end if;
  insert into order_refunds (tenant_id, order_id, amount, delivery_amount, reason, created_by) values (o.tenant_id, o.id, 0, v_delivery, nullif(trim(p_reason), ''), p_by) returning id into v_refund;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    select * into oi from order_items where id = (it->>'order_item_id')::uuid and order_id = o.id;
    if not found then
      raise exception 'An item does not belong to this order.';
    end if;
    v_qty := (it->>'quantity')::numeric;
    if v_qty is null or v_qty <= 0 then
      continue;
    end if;
    select coalesce(sum(x.quantity), 0) into v_done from order_refund_items x where x.order_item_id = oi.id;
    if v_qty > oi.ordered_quantity - v_done then
      raise exception 'You can refund at most % more of "%".', oi.ordered_quantity - v_done, oi.product_name;
    end if;
    v_ratio := v_qty / oi.ordered_quantity;
    v_amount := round((oi.line_total - coalesce(oi.discount_amount, 0)) * v_ratio, 2);
    insert into order_refund_items (tenant_id, refund_id, order_item_id, quantity, line_amount, amount, commission_reversed, supplier_discount_reversed, tax_reversed)
      values (o.tenant_id, v_refund, oi.id, v_qty, round(oi.line_total * v_ratio, 2), v_amount, round(coalesce(oi.commission_amount, 0) * v_ratio, 2), round(coalesce(oi.supplier_discount, 0) * v_ratio, 2), round(coalesce(oi.tax_amount, 0) * v_ratio, 2));
    v_total := v_total + v_amount;
  end loop;
  v_total := v_total + v_delivery;
  if v_total <= 0 then
    raise exception 'Choose what to refund.';
  end if;
  update order_refunds set amount = v_total where id = v_refund;
  update orders set refunded_amount = refunded_amount + v_total where id = o.id returning * into o;
  if o.refunded_amount >= o.total - 0.01 then
    update payments set status = 'refunded' where order_id = o.id;
  end if;
  return jsonb_build_object('refund_id', v_refund, 'amount', v_total, 'full', o.refunded_amount >= o.total - 0.01, 'user_id', o.user_id, 'order_number', o.order_number);
end;
$$;
grant execute on function refund_order_core(uuid, jsonb, boolean, text, uuid) to service_role;
revoke all on function refund_order_core(uuid, jsonb, boolean, text, uuid) from public, anon, authenticated;

create or replace function admin_refund_order(p_order uuid, p_items jsonb, p_delivery boolean, p_reason text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Only admins can refund an order.';
  end if;
  if not exists (select 1 from orders where id = p_order and tenant_id = current_tenant_id()) then
    raise exception 'Order not found.';
  end if;
  return refund_order_core(p_order, p_items, p_delivery, p_reason, auth.uid());
end;
$$;
grant execute on function admin_refund_order(uuid, jsonb, boolean, text) to authenticated;

create table if not exists order_returns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id() references tenants(id),
  return_number text not null unique default ('RT' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 7))),
  order_id uuid not null references orders(id) on delete cascade,
  order_item_id uuid not null references order_items(id) on delete cascade,
  user_id uuid not null references profiles(id),
  quantity numeric not null check (quantity > 0),
  reason text not null check (reason in ('damaged', 'wrong_item', 'missing_part', 'not_as_described', 'quality', 'changed_mind', 'other')),
  details text,
  photos text[] not null default '{}',
  status text not null default 'requested' check (status in ('requested', 'approved', 'pickup_assigned', 'picked_up', 'refunded', 'rejected', 'cancelled')),
  resolution text check (resolution in ('pickup', 'keep')),
  admin_note text,
  rider_id uuid references delivery_partners(id) on delete set null,
  pickup_code text not null default lpad((floor(random() * 10000))::int::text, 4, '0'),
  code_failures int not null default 0,
  refund_delivery boolean not null default false,
  refund_id uuid references order_refunds(id) on delete set null,
  refund_amount numeric,
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  picked_up_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists order_returns_order_idx on order_returns (order_id);
create index if not exists order_returns_item_idx on order_returns (order_item_id);
create index if not exists order_returns_status_idx on order_returns (tenant_id, status, created_at desc);
create index if not exists order_returns_rider_idx on order_returns (rider_id) where rider_id is not null;
alter table order_returns enable row level security;
drop policy if exists tenant_fence on order_returns;
create policy tenant_fence on order_returns as restrictive for all
  using (tenant_id = (select current_tenant_id()) or (select is_super_admin()))
  with check (tenant_id = (select current_tenant_id()) or (select is_super_admin()));
drop policy if exists "customers and admins read returns" on order_returns;
create policy "customers and admins read returns" on order_returns for select using (user_id = (select auth.uid()) or (select is_admin()));
-- All changes go through the functions below, never straight to the table.

-- The window, in days, for an item: its category, else the main category, else the market default. 0 means it cannot be returned.
create or replace function return_window_for_item(p_item uuid)
returns int
language sql stable security definer set search_path = public as $$
  select coalesce(c.return_window_days, pc.return_window_days, (select cs.default_return_window_days from company_settings cs where cs.tenant_id = o.tenant_id limit 1), 7)
  from order_items oi
  join orders o on o.id = oi.order_id
  left join product_variants pv on pv.id = oi.variant_id
  left join products p on p.id = pv.product_id
  left join categories c on c.id = p.category_id
  left join categories pc on pc.id = c.parent_id
  where oi.id = p_item;
$$;
revoke all on function return_window_for_item(uuid) from public;
grant execute on function return_window_for_item(uuid) to authenticated;

-- How many units of an item can still be returned: ordered, less refunded, less units in an open return.
create or replace function returnable_qty(p_item uuid)
returns numeric
language sql stable security definer set search_path = public as $$
  select greatest(0, oi.ordered_quantity
    - coalesce((select sum(x.quantity) from order_refund_items x where x.order_item_id = oi.id), 0)
    - coalesce((select sum(r.quantity) from order_returns r where r.order_item_id = oi.id and r.status in ('requested', 'approved', 'pickup_assigned', 'picked_up')), 0))
  from order_items oi where oi.id = p_item;
$$;
revoke all on function returnable_qty(uuid) from public;
grant execute on function returnable_qty(uuid) to authenticated;

-- When the order was delivered.
create or replace function order_delivered_at(p_order uuid)
returns timestamptz
language sql stable security definer set search_path = public as $$
  select coalesce((select max(h.created_at) from order_status_history h where h.order_id = p_order and h.status::text = 'delivered'), (select o.created_at from orders o where o.id = p_order and o.status::text = 'delivered'));
$$;
revoke all on function order_delivered_at(uuid) from public;
grant execute on function order_delivered_at(uuid) to authenticated;

-- Customer: ask to return an item.
create or replace function request_return(p_item uuid, p_qty numeric, p_reason text, p_details text, p_photos text[])
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  oi order_items%rowtype;
  o orders%rowtype;
  v_window int;
  v_delivered timestamptz;
  v_left numeric;
  v_auto boolean;
  v_defect boolean;
  v_status text := 'requested';
  v_remaining numeric;
  v_refund_delivery boolean := false;
  r order_returns%rowtype;
begin
  select * into oi from order_items where id = p_item;
  if not found then
    raise exception 'Item not found.';
  end if;
  select * into o from orders where id = oi.order_id;
  if o.user_id <> auth.uid() then
    raise exception 'You can only return items from your own orders.';
  end if;
  if o.status::text <> 'delivered' then
    raise exception 'You can return an item once the order has been delivered.';
  end if;
  v_window := return_window_for_item(p_item);
  if coalesce(v_window, 0) <= 0 then
    raise exception 'This item cannot be returned.';
  end if;
  v_delivered := order_delivered_at(o.id);
  if v_delivered is null or now() > v_delivered + (v_window || ' days')::interval then
    raise exception 'The return period for this item (% days from delivery) has ended.', v_window;
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'Choose how many to return.';
  end if;
  v_left := returnable_qty(p_item);
  if p_qty > v_left then
    if v_left <= 0 then
      raise exception 'This item has already been returned or refunded.';
    end if;
    raise exception 'You can return at most % of this item.', v_left;
  end if;
  if p_reason not in ('damaged', 'wrong_item', 'missing_part', 'not_as_described', 'quality', 'changed_mind', 'other') then
    raise exception 'Choose a reason for the return.';
  end if;
  v_defect := p_reason in ('damaged', 'wrong_item', 'missing_part');
  if v_defect and coalesce(array_length(p_photos, 1), 0) = 0 and p_reason <> 'wrong_item' then
    raise exception 'Please add a photo of the problem.';
  end if;
  select coalesce((select cs.return_auto_approve from company_settings cs where cs.tenant_id = o.tenant_id limit 1), true) into v_auto;
  -- The delivery fee goes back too when the fault is ours and this return takes back the last items of the order.
  select coalesce(sum(returnable_qty(x.id)), 0) into v_remaining from order_items x where x.order_id = o.id;
  if v_defect and v_remaining - p_qty <= 0 then
    v_refund_delivery := true;
  end if;
  if v_auto and v_defect and coalesce(array_length(p_photos, 1), 0) > 0 then
    v_status := 'approved';
  end if;
  insert into order_returns (tenant_id, order_id, order_item_id, user_id, quantity, reason, details, photos, status, resolution, refund_delivery, reviewed_at)
    values (o.tenant_id, o.id, oi.id, o.user_id, p_qty, p_reason, nullif(trim(p_details), ''), coalesce(p_photos, '{}'), v_status, case when v_status = 'approved' then 'pickup' else null end, v_refund_delivery, case when v_status = 'approved' then now() else null end)
    returning * into r;
  return jsonb_build_object('id', r.id, 'return_number', r.return_number, 'status', r.status, 'order_number', o.order_number, 'product_name', oi.product_name, 'user_id', o.user_id);
end;
$$;
revoke all on function request_return(uuid, numeric, text, text, text[]) from public;
grant execute on function request_return(uuid, numeric, text, text, text[]) to authenticated;

-- Customer: change their mind before the item has been collected.
create or replace function cancel_return(p_return uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  r order_returns%rowtype;
begin
  select * into r from order_returns where id = p_return and user_id = auth.uid();
  if not found then
    raise exception 'Return not found.';
  end if;
  if r.status not in ('requested', 'approved', 'pickup_assigned') then
    raise exception 'This return can no longer be cancelled.';
  end if;
  update order_returns set status = 'cancelled', updated_at = now() where id = p_return;
end;
$$;
revoke all on function cancel_return(uuid) from public;
grant execute on function cancel_return(uuid) to authenticated;

-- Admin: approve (the rider collects it, or the customer keeps it) or reject a requested return.
create or replace function admin_review_return(p_return uuid, p_approve boolean, p_resolution text, p_refund_delivery boolean, p_note text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r order_returns%rowtype;
  o orders%rowtype;
  v_refund jsonb;
begin
  if not is_admin() then
    raise exception 'Only admins can review returns.';
  end if;
  select * into r from order_returns where id = p_return and tenant_id = current_tenant_id();
  if not found then
    raise exception 'Return not found.';
  end if;
  if r.status <> 'requested' then
    raise exception 'This return has already been reviewed.';
  end if;
  select * into o from orders where id = r.order_id;
  if not p_approve then
    if nullif(trim(p_note), '') is null then
      raise exception 'Tell the customer why the return was rejected.';
    end if;
    update order_returns set status = 'rejected', admin_note = trim(p_note), reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now() where id = p_return;
    return jsonb_build_object('status', 'rejected', 'user_id', r.user_id, 'return_number', r.return_number, 'order_number', o.order_number);
  end if;
  if p_resolution not in ('pickup', 'keep') then
    raise exception 'Choose whether a rider collects the item or the customer keeps it.';
  end if;
  if p_resolution = 'keep' then
    v_refund := refund_order_core(r.order_id, jsonb_build_array(jsonb_build_object('order_item_id', r.order_item_id, 'quantity', r.quantity)), coalesce(p_refund_delivery, false), 'Return ' || r.return_number, auth.uid());
    update order_returns set status = 'refunded', resolution = 'keep', refund_delivery = coalesce(p_refund_delivery, false), admin_note = nullif(trim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now(), refund_id = (v_refund->>'refund_id')::uuid, refund_amount = (v_refund->>'amount')::numeric, refunded_at = now(), updated_at = now() where id = p_return;
    return jsonb_build_object('status', 'refunded', 'user_id', r.user_id, 'return_number', r.return_number, 'order_number', o.order_number, 'amount', (v_refund->>'amount')::numeric);
  end if;
  update order_returns set status = 'approved', resolution = 'pickup', refund_delivery = coalesce(p_refund_delivery, false), admin_note = nullif(trim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now() where id = p_return;
  return jsonb_build_object('status', 'approved', 'user_id', r.user_id, 'return_number', r.return_number, 'order_number', o.order_number);
end;
$$;
revoke all on function admin_review_return(uuid, boolean, text, boolean, text) from public;
grant execute on function admin_review_return(uuid, boolean, text, boolean, text) to authenticated;

-- Admin: send a rider to collect an approved return.
create or replace function admin_assign_return_rider(p_return uuid, p_rider uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r order_returns%rowtype;
  o orders%rowtype;
begin
  if not is_admin() then
    raise exception 'Only admins can assign a rider.';
  end if;
  select * into r from order_returns where id = p_return and tenant_id = current_tenant_id();
  if not found then
    raise exception 'Return not found.';
  end if;
  if r.status not in ('approved', 'pickup_assigned') or r.resolution is distinct from 'pickup' then
    raise exception 'Only an approved return that needs collecting can be given to a rider.';
  end if;
  if not exists (select 1 from delivery_partners dp where dp.id = p_rider and dp.tenant_id = current_tenant_id() and dp.status = 'approved') then
    raise exception 'Choose an approved rider from this market.';
  end if;
  select * into o from orders where id = r.order_id;
  update order_returns set rider_id = p_rider, status = 'pickup_assigned', updated_at = now() where id = p_return;
  return jsonb_build_object('rider_id', p_rider, 'return_number', r.return_number, 'order_number', o.order_number, 'user_id', r.user_id);
end;
$$;
revoke all on function admin_assign_return_rider(uuid, uuid) from public;
grant execute on function admin_assign_return_rider(uuid, uuid) to authenticated;

-- Rider: confirm the collection with the customer's code. The item is refunded at that moment.
create or replace function rider_confirm_return_pickup(p_return uuid, p_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r order_returns%rowtype;
  o orders%rowtype;
  v_refund jsonb;
begin
  select * into r from order_returns where id = p_return and rider_id = auth.uid();
  if not found then
    raise exception 'This return is not assigned to you.';
  end if;
  if r.status <> 'pickup_assigned' then
    raise exception 'This return is not waiting to be collected.';
  end if;
  if r.code_failures >= 5 then
    raise exception 'Too many wrong codes. Ask FasTrack to help.';
  end if;
  if regexp_replace(coalesce(p_code, ''), '\s', '', 'g') <> r.pickup_code then
    update order_returns set code_failures = code_failures + 1 where id = p_return;
    return jsonb_build_object('ok', false);
  end if;
  select * into o from orders where id = r.order_id;
  v_refund := refund_order_core(r.order_id, jsonb_build_array(jsonb_build_object('order_item_id', r.order_item_id, 'quantity', r.quantity)), r.refund_delivery, 'Return ' || r.return_number, auth.uid());
  update order_returns set status = 'refunded', picked_up_at = now(), refunded_at = now(), refund_id = (v_refund->>'refund_id')::uuid, refund_amount = (v_refund->>'amount')::numeric, updated_at = now() where id = p_return;
  return jsonb_build_object('ok', true, 'user_id', r.user_id, 'return_number', r.return_number, 'order_number', o.order_number, 'amount', (v_refund->>'amount')::numeric);
end;
$$;
revoke all on function rider_confirm_return_pickup(uuid, text) from public;
grant execute on function rider_confirm_return_pickup(uuid, text) to authenticated;

-- Rider: the returns waiting to be collected, with where to go. The customer's code is not shown.
create or replace function rider_return_pickups()
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'return_number', r.return_number, 'order_number', o.order_number, 'product_name', oi.product_name, 'variant_label', oi.variant_label,
    'quantity', r.quantity, 'reason', r.reason, 'created_at', r.created_at,
    'customer_name', coalesce(a.receiver_name, pr.full_name), 'customer_phone', coalesce(a.receiver_phone, pr.phone),
    'address_line', a.address_line, 'city', a.city, 'district', a.district, 'building_number', a.building_number, 'unit_number', a.unit_number, 'lat', a.lat, 'lng', a.lng
  ) order by r.created_at), '[]'::jsonb)
  from order_returns r
  join orders o on o.id = r.order_id
  join order_items oi on oi.id = r.order_item_id
  left join addresses a on a.id = o.address_id
  left join profiles pr on pr.id = o.user_id
  where r.rider_id = auth.uid() and r.status = 'pickup_assigned';
$$;
revoke all on function rider_return_pickups() from public;
grant execute on function rider_return_pickups() to authenticated;

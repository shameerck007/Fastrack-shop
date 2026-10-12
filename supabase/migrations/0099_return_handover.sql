-- Returns, part 2: where the returned item goes, and getting it back into stock.
--  * Every return knows its destination: the supplier (for a supplier's product) or the FasTrack warehouse that filled the order.
--  * When the rider collects the item (and the customer is refunded) it becomes "awaiting drop-off". The rider sees where to take it.
--  * The receiver (the supplier, that warehouse's staff, or an admin) marks it received, in good condition (the units go back into stock)
--    or damaged (no stock change).
--  * Suppliers and warehouse staff can see the returns coming to them.
-- Run in the Supabase SQL editor. Safe to run more than once. No blank lines inside function bodies.

alter table order_returns add column if not exists return_to text check (return_to in ('warehouse', 'supplier'));
alter table order_returns add column if not exists store_id uuid references stores(id) on delete set null;
alter table order_returns add column if not exists warehouse_id uuid references warehouses(id) on delete set null;
alter table order_returns add column if not exists stock_status text check (stock_status in ('awaiting_dropoff', 'received_good', 'received_damaged'));
alter table order_returns add column if not exists received_at timestamptz;
alter table order_returns add column if not exists received_by uuid references profiles(id) on delete set null;
alter table order_returns add column if not exists received_note text;
create index if not exists order_returns_store_idx on order_returns (store_id) where store_id is not null;
create index if not exists order_returns_warehouse_idx on order_returns (warehouse_id) where warehouse_id is not null;

-- Works out the destination when a return is created.
create or replace function set_return_destination()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_store uuid;
  v_wh uuid;
begin
  select p.store_id into v_store
    from order_items oi join product_variants pv on pv.id = oi.variant_id join products p on p.id = pv.product_id
    where oi.id = new.order_item_id;
  select o.warehouse_id into v_wh from orders o where o.id = new.order_id;
  new.store_id := v_store;
  new.warehouse_id := v_wh;
  new.return_to := case when v_store is not null then 'supplier' else 'warehouse' end;
  return new;
end;
$$;
drop trigger if exists trg_set_return_destination on order_returns;
create trigger trg_set_return_destination before insert on order_returns for each row execute function set_return_destination();

-- A collected item is waiting to be dropped off.
create or replace function set_return_stock_status()
returns trigger
language plpgsql as $$
begin
  if new.status = 'refunded' and old.status is distinct from 'refunded' and new.resolution = 'pickup' and new.stock_status is null then
    new.stock_status := 'awaiting_dropoff';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_set_return_stock_status on order_returns;
create trigger trg_set_return_stock_status before update on order_returns for each row execute function set_return_stock_status();

-- Returns that already exist get a destination too.
update order_returns r set
  store_id = (select p.store_id from order_items oi join product_variants pv on pv.id = oi.variant_id join products p on p.id = pv.product_id where oi.id = r.order_item_id),
  warehouse_id = (select o.warehouse_id from orders o where o.id = r.order_id)
  where r.return_to is null;
update order_returns set return_to = case when store_id is not null then 'supplier' else 'warehouse' end where return_to is null;
update order_returns set stock_status = 'awaiting_dropoff' where status = 'refunded' and resolution = 'pickup' and stock_status is null;

-- The supplier sees returns of its own products, and warehouse staff see returns coming to their warehouse.
drop policy if exists "suppliers read returns of their products" on order_returns;
create policy "suppliers read returns of their products" on order_returns for select
  using (store_id is not null and exists (select 1 from stores s where s.id = order_returns.store_id and s.owner_id = (select auth.uid())));
drop policy if exists "warehouse staff read returns to their warehouse" on order_returns;
create policy "warehouse staff read returns to their warehouse" on order_returns for select
  using (return_to = 'warehouse' and warehouse_id is not null and warehouse_id = (select my_staff_warehouse_id()));

-- Who may receive a return: an admin of the market, the supplier it goes back to, or the staff of the warehouse it goes back to.
create or replace function can_receive_return(p_return uuid)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  r order_returns%rowtype;
begin
  select * into r from order_returns where id = p_return;
  if not found then
    return false;
  end if;
  return coalesce((is_admin() and r.tenant_id = current_tenant_id())
    or (r.return_to = 'supplier' and exists (select 1 from stores s where s.id = r.store_id and s.owner_id = auth.uid()))
    or (r.return_to = 'warehouse' and coalesce(r.warehouse_id = my_staff_warehouse_id(), false)), false);
end;
$$;
revoke all on function can_receive_return(uuid) from public;
grant execute on function can_receive_return(uuid) to authenticated;

-- The receiver checks the item in. Good condition puts the units back into stock; damaged does not.
create or replace function receive_return(p_return uuid, p_condition text, p_note text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r order_returns%rowtype;
  oi order_items%rowtype;
  o orders%rowtype;
begin
  if not can_receive_return(p_return) then
    raise exception 'Only the store the item goes back to, or an admin, can receive this return.';
  end if;
  if p_condition not in ('good', 'damaged') then
    raise exception 'Choose whether the item is in good condition or damaged.';
  end if;
  select * into r from order_returns where id = p_return;
  if r.stock_status is distinct from 'awaiting_dropoff' then
    raise exception 'This return is not waiting to be received.';
  end if;
  select * into oi from order_items where id = r.order_item_id;
  select * into o from orders where id = r.order_id;
  if p_condition = 'good' and o.warehouse_id is not null then
    update inventory set stock = stock + r.quantity, updated_at = now() where variant_id = oi.variant_id and warehouse_id = o.warehouse_id;
    if not found then
      insert into inventory (variant_id, warehouse_id, stock) values (oi.variant_id, o.warehouse_id, r.quantity);
    end if;
  end if;
  update order_returns set stock_status = case when p_condition = 'good' then 'received_good' else 'received_damaged' end, received_at = now(), received_by = auth.uid(), received_note = nullif(trim(p_note), ''), updated_at = now() where id = p_return;
  return jsonb_build_object('return_number', r.return_number, 'order_number', o.order_number, 'condition', p_condition, 'product_name', oi.product_name);
end;
$$;
revoke all on function receive_return(uuid, text, text) from public;
grant execute on function receive_return(uuid, text, text) to authenticated;

-- Rider: collected returns and where to take them.
create or replace function rider_return_dropoffs()
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'return_number', r.return_number, 'order_number', o.order_number, 'product_name', oi.product_name, 'quantity', r.quantity,
    'return_to', r.return_to,
    'dest_name', case when r.return_to = 'supplier' then s.name else w.name end,
    'dest_address', case when r.return_to = 'supplier' then s.address_line else w.address_line end,
    'dest_phone', case when r.return_to = 'supplier' then s.contact_phone else null end,
    'lat', case when r.return_to = 'supplier' then s.lat else w.lat end,
    'lng', case when r.return_to = 'supplier' then s.lng else w.lng end
  ) order by r.picked_up_at), '[]'::jsonb)
  from order_returns r
  join orders o on o.id = r.order_id
  join order_items oi on oi.id = r.order_item_id
  left join stores s on s.id = r.store_id
  left join warehouses w on w.id = r.warehouse_id
  where r.rider_id = auth.uid() and r.stock_status = 'awaiting_dropoff';
$$;
revoke all on function rider_return_dropoffs() from public;
grant execute on function rider_return_dropoffs() to authenticated;

-- People to tell when a collected item is on its way to them.
create or replace function return_dropoff_recipients(p_return uuid)
returns table (user_id uuid)
language sql stable security definer set search_path = public as $$
  select s.owner_id from order_returns r join stores s on s.id = r.store_id where r.id = p_return and r.return_to = 'supplier' and (r.rider_id = auth.uid() or is_admin())
  union
  select ws.user_id from order_returns r join warehouse_staff ws on ws.warehouse_id = r.warehouse_id where r.id = p_return and r.return_to = 'warehouse' and (r.rider_id = auth.uid() or is_admin());
$$;
revoke all on function return_dropoff_recipients(uuid) from public;
grant execute on function return_dropoff_recipients(uuid) to authenticated;

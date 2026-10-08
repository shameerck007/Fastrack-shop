-- Stock transfers between FasTrack's own locations (warehouses / dark stores) and low-stock alerts.
-- Transfer flow: draft -> in_transit (stock leaves the sending location) -> received (stock arrives at the receiving location).
-- Admins can do everything; location staff can create and send from their own location and receive at theirs.
-- Low-stock alerts: when an item at a FasTrack location drops below its minimum stock the location's staff and the admins are
-- told once (and again only after it was restocked). The minimum is the existing inventory.min_stock.
-- Run the whole file in the Supabase SQL editor. No blank lines inside function bodies.

create table if not exists stock_transfers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id() references tenants(id),
  transfer_number text not null,
  from_warehouse_id uuid not null references warehouses(id),
  to_warehouse_id uuid not null references warehouses(id),
  status text not null default 'draft' check (status in ('draft', 'in_transit', 'received', 'cancelled')),
  note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  received_at timestamptz,
  check (from_warehouse_id <> to_warehouse_id)
);
create index if not exists stock_transfers_status_idx on stock_transfers (tenant_id, status);
create index if not exists stock_transfers_from_idx on stock_transfers (from_warehouse_id);
create index if not exists stock_transfers_to_idx on stock_transfers (to_warehouse_id);

create table if not exists stock_transfer_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id() references tenants(id),
  transfer_id uuid not null references stock_transfers(id) on delete cascade,
  variant_id uuid not null references product_variants(id),
  quantity numeric(10, 3) not null check (quantity > 0),
  received_quantity numeric(10, 3)
);
create index if not exists stock_transfer_items_transfer_idx on stock_transfer_items (transfer_id);

create table if not exists low_stock_notified (
  warehouse_id uuid not null references warehouses(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete cascade,
  notified_at timestamptz not null default now(),
  primary key (warehouse_id, variant_id)
);
alter table low_stock_notified enable row level security;

alter table stock_transfers enable row level security;
alter table stock_transfer_items enable row level security;
drop policy if exists "see own transfers" on stock_transfers;
create policy "see own transfers" on stock_transfers for select using (
  is_admin() or from_warehouse_id = my_staff_warehouse_id() or to_warehouse_id = my_staff_warehouse_id()
);
drop policy if exists "see own transfer items" on stock_transfer_items;
create policy "see own transfer items" on stock_transfer_items for select using (
  exists (select 1 from stock_transfers t where t.id = stock_transfer_items.transfer_id)
);
drop policy if exists tenant_fence on stock_transfers;
create policy tenant_fence on stock_transfers as restrictive for all using (tenant_id = current_tenant_id() or is_super_admin()) with check (tenant_id = current_tenant_id() or is_super_admin());
drop policy if exists tenant_fence on stock_transfer_items;
create policy tenant_fence on stock_transfer_items as restrictive for all using (tenant_id = current_tenant_id() or is_super_admin()) with check (tenant_id = current_tenant_id() or is_super_admin());

-- A FasTrack location is a warehouse no supplier owns.
create or replace function is_fastrack_location(p_warehouse uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from warehouses w where w.id = p_warehouse) and not exists (select 1 from stores s where s.warehouse_id = p_warehouse);
$$;

create or replace function create_stock_transfer(p_from uuid, p_to uuid, p_items jsonb, p_note text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_item jsonb;
  v_tenant uuid;
begin
  if not (is_admin() or my_staff_warehouse_id() = p_from) then raise exception 'You can only send stock from your own location.'; end if;
  if p_from = p_to then raise exception 'Choose two different locations.'; end if;
  if not (is_fastrack_location(p_from) and is_fastrack_location(p_to)) then raise exception 'Transfers are between FasTrack locations only.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Add at least one product.'; end if;
  select w.tenant_id into v_tenant from warehouses w where w.id = p_from;
  insert into stock_transfers (tenant_id, transfer_number, from_warehouse_id, to_warehouse_id, note, created_by)
    values (v_tenant, 'TR' || to_char(now(), 'YYMMDD') || lpad((floor(random() * 10000))::int::text, 4, '0'), p_from, p_to, nullif(trim(coalesce(p_note, '')), ''), auth.uid())
    returning id into v_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    if coalesce((v_item ->> 'quantity')::numeric, 0) <= 0 then raise exception 'Quantities must be more than zero.'; end if;
    insert into stock_transfer_items (tenant_id, transfer_id, variant_id, quantity) values (v_tenant, v_id, (v_item ->> 'variant_id')::uuid, (v_item ->> 'quantity')::numeric);
  end loop;
  return v_id;
end;
$$;
grant execute on function create_stock_transfer(uuid, uuid, jsonb, text) to authenticated;

-- Stock leaves the sending location.
create or replace function send_stock_transfer(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_t stock_transfers%rowtype;
  r record;
  v_rows int;
begin
  select * into v_t from stock_transfers where id = p_id for update;
  if not found then raise exception 'Transfer not found.'; end if;
  if not (is_admin() or my_staff_warehouse_id() = v_t.from_warehouse_id) then raise exception 'Only the sending location can send this.'; end if;
  if v_t.status <> 'draft' then raise exception 'This transfer was already sent.'; end if;
  for r in select i.variant_id, i.quantity, p.name from stock_transfer_items i join product_variants v on v.id = i.variant_id join products p on p.id = v.product_id where i.transfer_id = p_id loop
    update inventory set stock = stock - r.quantity, updated_at = now() where variant_id = r.variant_id and warehouse_id = v_t.from_warehouse_id and stock >= r.quantity;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then raise exception 'Not enough stock of % to send.', r.name; end if;
  end loop;
  update stock_transfers set status = 'in_transit', sent_at = now() where id = p_id;
end;
$$;
grant execute on function send_stock_transfer(uuid) to authenticated;

-- Stock arrives at the receiving location (received_quantity defaults to what was sent).
create or replace function receive_stock_transfer(p_id uuid, p_received jsonb default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_t stock_transfers%rowtype;
  r record;
  v_qty numeric;
begin
  select * into v_t from stock_transfers where id = p_id for update;
  if not found then raise exception 'Transfer not found.'; end if;
  if not (is_admin() or my_staff_warehouse_id() = v_t.to_warehouse_id) then raise exception 'Only the receiving location can receive this.'; end if;
  if v_t.status <> 'in_transit' then raise exception 'This transfer is not on its way.'; end if;
  for r in select i.id, i.variant_id, i.quantity from stock_transfer_items i where i.transfer_id = p_id loop
    v_qty := r.quantity;
    if p_received is not null and p_received ? r.id::text then v_qty := least((p_received ->> r.id::text)::numeric, r.quantity); end if;
    if v_qty < 0 then v_qty := 0; end if;
    update stock_transfer_items set received_quantity = v_qty where id = r.id;
    insert into inventory (variant_id, warehouse_id, stock) values (r.variant_id, v_t.to_warehouse_id, v_qty)
      on conflict (variant_id, warehouse_id) do update set stock = inventory.stock + excluded.stock, updated_at = now();
  end loop;
  update stock_transfers set status = 'received', received_at = now() where id = p_id;
end;
$$;
grant execute on function receive_stock_transfer(uuid, jsonb) to authenticated;

-- Cancel: a draft just closes; one on its way gives the stock back to the sending location.
create or replace function cancel_stock_transfer(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_t stock_transfers%rowtype;
  r record;
begin
  select * into v_t from stock_transfers where id = p_id for update;
  if not found then raise exception 'Transfer not found.'; end if;
  if not (is_admin() or my_staff_warehouse_id() = v_t.from_warehouse_id) then raise exception 'Only the sending location can cancel this.'; end if;
  if v_t.status not in ('draft', 'in_transit') then raise exception 'This transfer can no longer be cancelled.'; end if;
  if v_t.status = 'in_transit' then
    for r in select i.variant_id, i.quantity from stock_transfer_items i where i.transfer_id = p_id loop
      insert into inventory (variant_id, warehouse_id, stock) values (r.variant_id, v_t.from_warehouse_id, r.quantity)
        on conflict (variant_id, warehouse_id) do update set stock = inventory.stock + excluded.stock, updated_at = now();
    end loop;
  end if;
  update stock_transfers set status = 'cancelled' where id = p_id;
end;
$$;
grant execute on function cancel_stock_transfer(uuid) to authenticated;

-- Low stock, run every minute by the cron worker. Returns the FasTrack locations that have newly gone low, with a sample of items.
create or replace function sweep_low_stock()
returns table (out_warehouse_id uuid, out_count int, out_sample text)
language plpgsql security definer set search_path = public as $$
begin
  delete from low_stock_notified n using inventory i where i.warehouse_id = n.warehouse_id and i.variant_id = n.variant_id and (i.min_stock <= 0 or i.stock >= i.min_stock);
  return query
    with fresh as (
      insert into low_stock_notified (warehouse_id, variant_id)
      select i.warehouse_id, i.variant_id from inventory i
      where i.min_stock > 0 and i.stock < i.min_stock and not exists (select 1 from stores s where s.warehouse_id = i.warehouse_id)
      on conflict do nothing
      returning warehouse_id, variant_id
    )
    select f.warehouse_id, count(*)::int, array_to_string((array_agg(distinct p.name))[1:3], ', ')
    from fresh f join product_variants v on v.id = f.variant_id join products p on p.id = v.product_id
    group by f.warehouse_id;
end;
$$;
grant execute on function sweep_low_stock() to service_role;

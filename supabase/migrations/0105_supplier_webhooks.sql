-- Supplier webhooks: FasTrack calls a supplier's web address when something happens to an order with their items.
--  * supplier_webhooks: one row per store (address, signing secret, on/off).
--  * supplier_webhook_events: the outbox. Database triggers add a row when an order is created, picked up, delivered or
--    cancelled, or when a return is requested. A worker (the per-minute cron) sends them and retries failures
--    (1 min, 10 min, 1 hour, 6 hours, then gives up and marks the event failed).
--  * The message itself is built at send time from the current order, so an order's items are always complete.
-- The triggers never block or fail an order: any error inside them is swallowed.
-- Safe to run more than once.

create table if not exists supplier_webhooks (
  store_id uuid primary key references stores(id) on delete cascade,
  tenant_id uuid not null references tenants(id),
  url text not null check (url ~ '^https://'),
  secret text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table supplier_webhooks enable row level security;
drop policy if exists tenant_fence on supplier_webhooks;
create policy tenant_fence on supplier_webhooks as restrictive for all
  using (tenant_id = (select current_tenant_id()) or (select is_super_admin()))
  with check (tenant_id = (select current_tenant_id()) or (select is_super_admin()));
drop policy if exists "supplier manages own webhook" on supplier_webhooks;
create policy "supplier manages own webhook" on supplier_webhooks for all
  using (exists (select 1 from stores s where s.id = store_id and s.owner_id = (select auth.uid())))
  with check (exists (select 1 from stores s where s.id = store_id and s.owner_id = (select auth.uid()) and s.status::text = 'approved'));

create table if not exists supplier_webhook_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  store_id uuid not null references stores(id) on delete cascade,
  event text not null,
  order_id uuid references orders(id) on delete cascade,
  return_id uuid references order_returns(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'delivered', 'failed')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_status int,
  last_error text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);
create unique index if not exists swe_once_per_order on supplier_webhook_events (store_id, order_id, event) where order_id is not null and return_id is null;
create unique index if not exists swe_once_per_return on supplier_webhook_events (store_id, return_id, event) where return_id is not null;
create index if not exists swe_due_idx on supplier_webhook_events (next_attempt_at) where status = 'pending';
create index if not exists swe_store_idx on supplier_webhook_events (store_id, created_at desc);
alter table supplier_webhook_events enable row level security;
drop policy if exists tenant_fence on supplier_webhook_events;
create policy tenant_fence on supplier_webhook_events as restrictive for all
  using (tenant_id = (select current_tenant_id()) or (select is_super_admin()))
  with check (tenant_id = (select current_tenant_id()) or (select is_super_admin()));
drop policy if exists "supplier reads own webhook events" on supplier_webhook_events;
create policy "supplier reads own webhook events" on supplier_webhook_events for select
  using (exists (select 1 from stores s where s.id = store_id and s.owner_id = (select auth.uid())));

-- Adds the event for one store, only if that store has an enabled webhook.
create or replace function enqueue_webhook_event(p_store uuid, p_event text, p_order uuid, p_return uuid, p_delay interval default interval '0')
returns void language plpgsql security definer set search_path = public as $$
declare w supplier_webhooks%rowtype;
begin
  select * into w from supplier_webhooks where store_id = p_store and enabled;
  if not found then return; end if;
  insert into supplier_webhook_events (tenant_id, store_id, event, order_id, return_id, next_attempt_at)
  values (w.tenant_id, p_store, p_event, p_order, p_return, now() + p_delay)
  on conflict do nothing;
exception when others then
  null;
end $$;
revoke all on function enqueue_webhook_event(uuid, text, uuid, uuid, interval) from public, anon, authenticated;

create or replace function trg_webhook_order_item() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_store uuid;
begin
  select p.store_id into v_store from product_variants v join products p on p.id = v.product_id where v.id = new.variant_id;
  if v_store is not null then
    -- a short delay so every item of the order is in before the message is built
    perform enqueue_webhook_event(v_store, 'order.created', new.order_id, null, interval '20 seconds');
  end if;
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists webhook_order_item on order_items;
create trigger webhook_order_item after insert on order_items for each row execute function trg_webhook_order_item();

create or replace function trg_webhook_order_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_event text; r record;
begin
  v_event := case new.status::text
    when 'out_for_delivery' then 'order.picked_up'
    when 'delivered' then 'order.delivered'
    when 'cancelled' then 'order.cancelled'
    else null end;
  if v_event is not null then
    for r in
      select distinct p.store_id from order_items oi
      join product_variants v on v.id = oi.variant_id join products p on p.id = v.product_id
      where oi.order_id = new.id and p.store_id is not null
    loop
      perform enqueue_webhook_event(r.store_id, v_event, new.id, null);
    end loop;
  end if;
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists webhook_order_status on orders;
create trigger webhook_order_status after update of status on orders
  for each row when (old.status is distinct from new.status) execute function trg_webhook_order_status();

create or replace function trg_webhook_return() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.store_id is not null then
    perform enqueue_webhook_event(new.store_id, 'return.requested', new.order_id, new.id);
  end if;
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists webhook_return on order_returns;
create trigger webhook_return after insert on order_returns for each row execute function trg_webhook_return();

-- The worker: take due events (safe if two workers run at once), and record each result.
create or replace function claim_webhook_events(p_limit int default 25)
returns table (id uuid, store_id uuid, event text, order_id uuid, return_id uuid, attempts int, url text, secret text)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with due as (
    select e.id from supplier_webhook_events e
    where e.status = 'pending' and e.next_attempt_at <= now()
    order by e.next_attempt_at
    limit p_limit
    for update skip locked
  ), leased as (
    update supplier_webhook_events e
    set next_attempt_at = now() + interval '2 minutes'
    from due where e.id = due.id
    returning e.id, e.store_id, e.event, e.order_id, e.return_id, e.attempts
  )
  select l.id, l.store_id, l.event, l.order_id, l.return_id, l.attempts, w.url, w.secret
  from leased l join supplier_webhooks w on w.store_id = l.store_id and w.enabled;
end $$;
revoke all on function claim_webhook_events(int) from public, anon, authenticated;

create or replace function finish_webhook_event(p_id uuid, p_ok boolean, p_status int, p_error text)
returns void language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select attempts + 1 into n from supplier_webhook_events where id = p_id;
  if p_ok then
    update supplier_webhook_events set status = 'delivered', attempts = n, last_status = p_status, last_error = null, delivered_at = now() where id = p_id;
  elsif n >= 5 then
    update supplier_webhook_events set status = 'failed', attempts = n, last_status = p_status, last_error = left(p_error, 300) where id = p_id;
  else
    update supplier_webhook_events
    set attempts = n, last_status = p_status, last_error = left(p_error, 300),
        next_attempt_at = now() + (case n when 1 then interval '1 minute' when 2 then interval '10 minutes' when 3 then interval '1 hour' else interval '6 hours' end)
    where id = p_id;
  end if;
end $$;
revoke all on function finish_webhook_event(uuid, boolean, int, text) from public, anon, authenticated;

-- Events whose webhook was switched off or removed are not sent.
create or replace function drop_orphan_webhook_events() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from supplier_webhook_events e
  where e.status = 'pending' and not exists (select 1 from supplier_webhooks w where w.store_id = e.store_id and w.enabled);
  get diagnostics n = row_count;
  delete from supplier_webhook_events where created_at < now() - interval '30 days';
  return n;
end $$;
revoke all on function drop_orphan_webhook_events() from public, anon, authenticated;

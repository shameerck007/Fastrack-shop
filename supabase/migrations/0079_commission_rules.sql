-- Commission by rules instead of one rate per supplier. The most specific rule wins:
--   1. a product rule (one catalog product, for one supplier or for all)
--   2. a supplier + category rule
--   3. a category rule (a sub-category inherits its parent's rule)
--   4. the supplier's own agreed rate (stores.commission_rate, as before)
-- The rate that applied is saved on each order line when the order is placed, so changing a rule later never changes past orders, and the
-- settlement ledger adds up the saved amounts. FasTrack's own products carry no commission.
-- Run the whole file in the Supabase SQL editor. No blank lines inside function bodies.

alter table company_settings add column if not exists default_commission_rate numeric not null default 15 check (default_commission_rate >= 0 and default_commission_rate <= 100);

create table if not exists commission_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id() references tenants(id),
  store_id uuid references stores(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  master_id uuid references master_products(id) on delete cascade,
  rate numeric not null check (rate >= 0 and rate <= 100),
  starts_on date,
  ends_on date,
  is_active boolean not null default true,
  note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (store_id is not null or category_id is not null or master_id is not null)
);
create index if not exists commission_rules_tenant_idx on commission_rules (tenant_id, is_active);
create index if not exists commission_rules_category_idx on commission_rules (category_id) where category_id is not null;
create index if not exists commission_rules_master_idx on commission_rules (master_id) where master_id is not null;
alter table commission_rules enable row level security;
drop policy if exists tenant_fence on commission_rules;
create policy tenant_fence on commission_rules as restrictive for all
  using (tenant_id = (select current_tenant_id()) or (select is_super_admin()))
  with check (tenant_id = (select current_tenant_id()) or (select is_super_admin()));
drop policy if exists "admins manage commission rules" on commission_rules;
create policy "admins manage commission rules" on commission_rules for all using ((select is_admin())) with check ((select is_admin()));

alter table order_items add column if not exists commission_rate numeric;
alter table order_items add column if not exists commission_amount numeric;

create or replace function commission_rate_for(p_store uuid, p_category uuid, p_master uuid, p_on date default current_date)
returns numeric
language plpgsql security definer set search_path = public stable as $$
declare
  v_tenant uuid;
  v_parent uuid;
  v_rate numeric;
begin
  if p_store is null then
    return 0;
  end if;
  select tenant_id into v_tenant from stores where id = p_store;
  if p_category is not null then
    select parent_id into v_parent from categories where id = p_category;
  end if;
  if p_master is not null then
    select r.rate into v_rate from commission_rules r
      where r.tenant_id = v_tenant and r.is_active and r.master_id = p_master and (r.store_id = p_store or r.store_id is null)
        and (r.starts_on is null or r.starts_on <= p_on) and (r.ends_on is null or r.ends_on >= p_on)
      order by (r.store_id is not null) desc, r.created_at desc limit 1;
    if found then
      return v_rate;
    end if;
  end if;
  if p_category is not null then
    select r.rate into v_rate from commission_rules r
      where r.tenant_id = v_tenant and r.is_active and r.store_id = p_store and r.master_id is null and r.category_id in (p_category, v_parent)
        and (r.starts_on is null or r.starts_on <= p_on) and (r.ends_on is null or r.ends_on >= p_on)
      order by (r.category_id = p_category) desc, r.created_at desc limit 1;
    if found then
      return v_rate;
    end if;
    select r.rate into v_rate from commission_rules r
      where r.tenant_id = v_tenant and r.is_active and r.store_id is null and r.master_id is null and r.category_id in (p_category, v_parent)
        and (r.starts_on is null or r.starts_on <= p_on) and (r.ends_on is null or r.ends_on >= p_on)
      order by (r.category_id = p_category) desc, r.created_at desc limit 1;
    if found then
      return v_rate;
    end if;
  end if;
  select commission_rate into v_rate from stores where id = p_store;
  return coalesce(v_rate, (select default_commission_rate from company_settings where tenant_id = v_tenant limit 1), 15);
end;
$$;
grant execute on function commission_rate_for(uuid, uuid, uuid, date) to authenticated;

create or replace function set_order_item_commission()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_store uuid;
  v_category uuid;
  v_master uuid;
  v_rate numeric;
begin
  select p.store_id, p.category_id, p.master_id into v_store, v_category, v_master
    from product_variants pv join products p on p.id = pv.product_id where pv.id = new.variant_id;
  if v_store is null then
    new.commission_rate := 0;
    new.commission_amount := 0;
  else
    v_rate := commission_rate_for(v_store, v_category, v_master, current_date);
    new.commission_rate := v_rate;
    new.commission_amount := round(new.line_total * v_rate / 100, 2);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_set_order_item_commission on order_items;
create trigger trg_set_order_item_commission before insert on order_items for each row execute function set_order_item_commission();

update order_items oi
  set commission_rate = s.commission_rate, commission_amount = round(oi.line_total * s.commission_rate / 100, 2)
  from product_variants pv, products p, stores s
  where pv.id = oi.variant_id and p.id = pv.product_id and s.id = p.store_id and oi.commission_rate is null;

create or replace function commission_preview(p_master_ids uuid[])
returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare
  v_store uuid;
begin
  select id into v_store from stores where owner_id = auth.uid();
  if v_store is null then
    return '{}'::jsonb;
  end if;
  return coalesce((select jsonb_object_agg(m.id::text, commission_rate_for(v_store, m.category_id, m.id, current_date)) from master_products m where m.id = any(p_master_ids)), '{}'::jsonb);
end;
$$;
grant execute on function commission_preview(uuid[]) to authenticated;

create or replace function store_settlement_summary(target_store_id uuid)
returns table (gross_sales numeric, commission_rate numeric, commission_amount numeric, net_earned numeric, paid_out numeric, balance_due numeric, delivered_order_count bigint)
language plpgsql security definer set search_path = public stable as $$
begin
  if not (is_admin() or exists (select 1 from stores s where s.id = target_store_id and s.owner_id = auth.uid())) then
    raise exception 'Not authorized to view this store''s settlement.';
  end if;
  return query
    select
      coalesce(sales.gross_sales, 0),
      case when coalesce(sales.gross_sales, 0) > 0 then round(sales.commission / sales.gross_sales * 100, 2) else s.commission_rate end,
      coalesce(sales.commission, 0),
      coalesce(sales.gross_sales, 0) - coalesce(sales.commission, 0),
      coalesce(payouts.paid_out, 0),
      coalesce(sales.gross_sales, 0) - coalesce(sales.commission, 0) - coalesce(payouts.paid_out, 0),
      coalesce(sales.order_count, 0)
    from stores s
    left join lateral (
      select sum(oi.line_total) as gross_sales,
             sum(coalesce(oi.commission_amount, oi.line_total * s.commission_rate / 100)) as commission,
             count(distinct oi.order_id) as order_count
      from order_items oi
      join product_variants pv on pv.id = oi.variant_id
      join products p on p.id = pv.product_id
      join orders o on o.id = oi.order_id
      where p.store_id = s.id and o.status = 'delivered'
    ) sales on true
    left join lateral (select sum(sp.amount) as paid_out from settlement_payouts sp where sp.store_id = s.id) payouts on true
    where s.id = target_store_id;
end;
$$;

create or replace function admin_settlement_overview()
returns table (store_id uuid, store_name text, store_status store_status, gross_sales numeric, commission_rate numeric, commission_amount numeric, net_earned numeric, paid_out numeric, balance_due numeric, delivered_order_count bigint)
language plpgsql security definer set search_path = public stable as $$
begin
  if not is_admin() then
    raise exception 'Only admins can view the settlement overview.';
  end if;
  return query
    select
      s.id, s.name, s.status,
      coalesce(sales.gross_sales, 0),
      case when coalesce(sales.gross_sales, 0) > 0 then round(sales.commission / sales.gross_sales * 100, 2) else s.commission_rate end,
      coalesce(sales.commission, 0),
      coalesce(sales.gross_sales, 0) - coalesce(sales.commission, 0),
      coalesce(payouts.paid_out, 0),
      coalesce(sales.gross_sales, 0) - coalesce(sales.commission, 0) - coalesce(payouts.paid_out, 0),
      coalesce(sales.order_count, 0)
    from stores s
    left join lateral (
      select sum(oi.line_total) as gross_sales,
             sum(coalesce(oi.commission_amount, oi.line_total * s.commission_rate / 100)) as commission,
             count(distinct oi.order_id) as order_count
      from order_items oi
      join product_variants pv on pv.id = oi.variant_id
      join products p on p.id = pv.product_id
      join orders o on o.id = oi.order_id
      where p.store_id = s.id and o.status = 'delivered'
    ) sales on true
    left join lateral (select sum(sp.amount) as paid_out from settlement_payouts sp where sp.store_id = s.id) payouts on true
    order by (coalesce(sales.gross_sales, 0) - coalesce(sales.commission, 0) - coalesce(payouts.paid_out, 0)) desc nulls last;
end;
$$;

create or replace function store_settlement_orders(target_store_id uuid)
returns table (order_id uuid, order_number text, delivered_at timestamptz, item_count bigint, line_total numeric, commission_amount numeric, net_amount numeric)
language plpgsql security definer set search_path = public stable as $$
begin
  if not (is_admin() or exists (select 1 from stores s where s.id = target_store_id and s.owner_id = auth.uid())) then
    raise exception 'Not authorized to view this store''s settlement.';
  end if;
  return query
    select
      o.id, o.order_number,
      (select max(h.created_at) from order_status_history h where h.order_id = o.id and h.status = 'delivered'),
      count(oi.id),
      sum(oi.line_total),
      sum(coalesce(oi.commission_amount, oi.line_total * s.commission_rate / 100)),
      sum(oi.line_total) - sum(coalesce(oi.commission_amount, oi.line_total * s.commission_rate / 100))
    from order_items oi
    join product_variants pv on pv.id = oi.variant_id
    join products p on p.id = pv.product_id
    join stores s on s.id = p.store_id
    join orders o on o.id = oi.order_id
    where p.store_id = target_store_id and o.status = 'delivered'
    group by o.id, o.order_number
    order by max(o.updated_at) desc;
end;
$$;

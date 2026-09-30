-- Supplier Settlement Ledger: what FasTrack owes each merchant for their
-- delivered orders (sale total minus the platform's commission), reconciled
-- against payouts admin has actually recorded, so both sides see the same
-- running balance — admin uses it to know who to pay and how much, the
-- merchant uses it to see exactly what they've earned and what's still due.

alter table stores add column if not exists commission_rate numeric not null default 15
  check (commission_rate >= 0 and commission_rate <= 100);
comment on column stores.commission_rate is
  'Percent of each delivered order''s line total that FasTrack keeps as its platform fee; the rest is what the store is owed.';

create table if not exists settlement_payouts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  amount numeric not null check (amount > 0),
  method text not null default 'bank_transfer',
  reference text,
  note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists settlement_payouts_store_idx on settlement_payouts(store_id, created_at desc);

alter table settlement_payouts enable row level security;

create policy "admins manage settlement payouts" on settlement_payouts for all
  using (is_admin()) with check (is_admin());
create policy "merchants view own settlement payouts" on settlement_payouts for select using (
  exists (select 1 from stores s where s.id = store_id and s.owner_id = auth.uid())
);

-- One store's lifetime summary: gross sales from delivered orders, the
-- commission split, and the running balance after payouts. Callable by an
-- admin for any store or a merchant for their own — SECURITY DEFINER
-- because it aggregates across order_items/product_variants/products the
-- same way order_has_my_store_item does, to avoid RLS recursion.
create or replace function store_settlement_summary(target_store_id uuid)
returns table (
  gross_sales numeric,
  commission_rate numeric,
  commission_amount numeric,
  net_earned numeric,
  paid_out numeric,
  balance_due numeric,
  delivered_order_count bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not (is_admin() or exists (select 1 from stores s where s.id = target_store_id and s.owner_id = auth.uid())) then
    raise exception 'Not authorized to view this store''s settlement.';
  end if;

  return query
    select
      coalesce(sales.gross_sales, 0),
      s.commission_rate,
      coalesce(sales.gross_sales, 0) * s.commission_rate / 100,
      coalesce(sales.gross_sales, 0) * (1 - s.commission_rate / 100),
      coalesce(payouts.paid_out, 0),
      coalesce(sales.gross_sales, 0) * (1 - s.commission_rate / 100) - coalesce(payouts.paid_out, 0),
      coalesce(sales.order_count, 0)
    from stores s
    left join lateral (
      select sum(oi.line_total) as gross_sales, count(distinct oi.order_id) as order_count
      from order_items oi
      join product_variants pv on pv.id = oi.variant_id
      join products p on p.id = pv.product_id
      join orders o on o.id = oi.order_id
      where p.store_id = s.id and o.status = 'delivered'
    ) sales on true
    left join lateral (
      select sum(sp.amount) as paid_out from settlement_payouts sp where sp.store_id = s.id
    ) payouts on true
    where s.id = target_store_id;
end;
$$;

grant execute on function store_settlement_summary(uuid) to authenticated;

-- Every store's summary in one call, for the admin overview list — same
-- shape as store_settlement_summary plus store identity, admin-only.
create or replace function admin_settlement_overview()
returns table (
  store_id uuid,
  store_name text,
  store_status store_status,
  gross_sales numeric,
  commission_rate numeric,
  commission_amount numeric,
  net_earned numeric,
  paid_out numeric,
  balance_due numeric,
  delivered_order_count bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not is_admin() then
    raise exception 'Only admins can view the settlement overview.';
  end if;

  return query
    select
      s.id,
      s.name,
      s.status,
      coalesce(sales.gross_sales, 0),
      s.commission_rate,
      coalesce(sales.gross_sales, 0) * s.commission_rate / 100,
      coalesce(sales.gross_sales, 0) * (1 - s.commission_rate / 100),
      coalesce(payouts.paid_out, 0),
      coalesce(sales.gross_sales, 0) * (1 - s.commission_rate / 100) - coalesce(payouts.paid_out, 0),
      coalesce(sales.order_count, 0)
    from stores s
    left join lateral (
      select sum(oi.line_total) as gross_sales, count(distinct oi.order_id) as order_count
      from order_items oi
      join product_variants pv on pv.id = oi.variant_id
      join products p on p.id = pv.product_id
      join orders o on o.id = oi.order_id
      where p.store_id = s.id and o.status = 'delivered'
    ) sales on true
    left join lateral (
      select sum(sp.amount) as paid_out from settlement_payouts sp where sp.store_id = s.id
    ) payouts on true
    order by (coalesce(sales.gross_sales, 0) * (1 - s.commission_rate / 100) - coalesce(payouts.paid_out, 0)) desc nulls last;
end;
$$;

grant execute on function admin_settlement_overview() to authenticated;

-- Order-level breakdown behind the summary, for the ledger table both
-- sides drill into — same authorization rule as store_settlement_summary.
create or replace function store_settlement_orders(target_store_id uuid)
returns table (
  order_id uuid,
  order_number text,
  delivered_at timestamptz,
  item_count bigint,
  line_total numeric,
  commission_amount numeric,
  net_amount numeric
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not (is_admin() or exists (select 1 from stores s where s.id = target_store_id and s.owner_id = auth.uid())) then
    raise exception 'Not authorized to view this store''s settlement.';
  end if;

  return query
    select
      o.id,
      o.order_number,
      (select max(h.created_at) from order_status_history h where h.order_id = o.id and h.status = 'delivered'),
      count(oi.id),
      sum(oi.line_total),
      sum(oi.line_total) * s.commission_rate / 100,
      sum(oi.line_total) * (1 - s.commission_rate / 100)
    from order_items oi
    join product_variants pv on pv.id = oi.variant_id
    join products p on p.id = pv.product_id
    join stores s on s.id = p.store_id
    join orders o on o.id = oi.order_id
    where p.store_id = target_store_id and o.status = 'delivered'
    group by o.id, o.order_number, s.commission_rate
    order by o.updated_at desc;
end;
$$;

grant execute on function store_settlement_orders(uuid) to authenticated;

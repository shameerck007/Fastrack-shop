-- Settlement ledger: every money movement for a supplier as one dated list, so a running balance can be shown.
--   store_settlement_ledger(store)   one row per delivered order (a sale), per refund after delivery, and per payout.
--   admin_settlement_monthly()      the same figures added up by month across the market's suppliers (admin chart).
-- The rows use the same definitions as store_settlement_summary / settlement_figures, so the amounts add up to the balance due:
--   amount = gross - commission - supplier-funded discount     (sale: positive; refund: negative; payout: negative)
-- Same access rule as the other settlement functions: the supplier themself, or an admin of the supplier's market.
-- Safe to run more than once.

create or replace function store_settlement_ledger(target_store_id uuid)
returns table (
  entry_at timestamptz, kind text, ref text, order_id uuid, description text,
  gross numeric, commission numeric, discount numeric, amount numeric
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (exists (select 1 from stores s where s.id = target_store_id and s.owner_id = auth.uid())
          or (is_admin() and exists (select 1 from stores s where s.id = target_store_id and s.tenant_id = current_tenant_id()))) then
    raise exception 'Not authorized to view this store''s settlement.';
  end if;
  return query
  with sales as (
    select o.id as oid, o.order_number as onum,
           (select max(h.created_at) from order_status_history h where h.order_id = o.id and h.status = 'delivered') as at,
           count(oi.id) as items,
           sum(oi.line_total) as gross,
           sum(coalesce(oi.commission_amount, oi.line_total * s.commission_rate / 100)) as commission,
           sum(coalesce(oi.supplier_discount, 0)) as discount
    from order_items oi
    join product_variants pv on pv.id = oi.variant_id
    join products p on p.id = pv.product_id
    join stores s on s.id = p.store_id
    join orders o on o.id = oi.order_id
    where p.store_id = target_store_id and o.status = 'delivered'
    group by o.id, o.order_number
  ), refunds_ as (
    select r.id as rid, r.order_id as oid, o.order_number as onum, r.created_at as at,
           sum(ri.line_amount) as gross, sum(ri.commission_reversed) as commission, sum(ri.supplier_discount_reversed) as discount, count(ri.id) as items
    from order_refund_items ri
    join order_refunds r on r.id = ri.refund_id
    join order_items oi on oi.id = ri.order_item_id
    join product_variants pv on pv.id = oi.variant_id
    join products p on p.id = pv.product_id
    join orders o on o.id = r.order_id
    where p.store_id = target_store_id and o.status = 'delivered'
    group by r.id, r.order_id, o.order_number, r.created_at
  )
  select s.at, 'sale'::text, s.onum, s.oid, (s.items || (case when s.items = 1 then ' item' else ' items' end))::text,
         s.gross, s.commission, s.discount, s.gross - s.commission - s.discount
  from sales s
  union all
  select r.at, 'refund'::text, r.onum, r.oid, ('Refund, ' || r.items || (case when r.items = 1 then ' item' else ' items' end))::text,
         -r.gross, -r.commission, -r.discount, -(r.gross - r.commission - r.discount)
  from refunds_ r
  union all
  select sp.created_at, 'payout'::text, coalesce(sp.reference, ''), null::uuid,
         (case sp.method when 'bank_transfer' then 'Bank transfer' when 'cheque' then 'Cheque' when 'cash' then 'Cash' else initcap(replace(sp.method, '_', ' ')) end || coalesce(' · ' || nullif(sp.note, ''), ''))::text,
         0::numeric, 0::numeric, 0::numeric, -sp.amount
  from settlement_payouts sp where sp.store_id = target_store_id
  order by 1, 2;
end $$;
grant execute on function store_settlement_ledger(uuid) to authenticated;

create or replace function admin_settlement_monthly()
returns table (month date, gross numeric, commission numeric, discount numeric, refunds numeric, net numeric, paid_out numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only.'; end if;
  return query
  with mine as (select s.id from stores s where s.tenant_id = current_tenant_id()),
  sales as (
    select date_trunc('month', (select max(h.created_at) from order_status_history h where h.order_id = o.id and h.status = 'delivered'))::date as m,
           sum(oi.line_total) as gross,
           sum(coalesce(oi.commission_amount, oi.line_total * s.commission_rate / 100)) as commission,
           sum(coalesce(oi.supplier_discount, 0)) as discount
    from order_items oi
    join product_variants pv on pv.id = oi.variant_id
    join products p on p.id = pv.product_id
    join stores s on s.id = p.store_id
    join orders o on o.id = oi.order_id
    where p.store_id in (select id from mine) and o.status = 'delivered'
    group by 1
  ), refunds_ as (
    select date_trunc('month', r.created_at)::date as m,
           sum(ri.line_amount) as gross, sum(ri.commission_reversed) as commission, sum(ri.supplier_discount_reversed) as discount
    from order_refund_items ri
    join order_refunds r on r.id = ri.refund_id
    join order_items oi on oi.id = ri.order_item_id
    join product_variants pv on pv.id = oi.variant_id
    join products p on p.id = pv.product_id
    join orders o on o.id = r.order_id
    where p.store_id in (select id from mine) and o.status = 'delivered'
    group by 1
  ), pay as (
    select date_trunc('month', sp.created_at)::date as m, sum(sp.amount) as paid
    from settlement_payouts sp where sp.store_id in (select id from mine) group by 1
  ), months as (
    select m from sales where m is not null union select m from refunds_ union select m from pay
  )
  select mo.m,
         coalesce(s.gross, 0), coalesce(s.commission, 0) - coalesce(r.commission, 0), coalesce(s.discount, 0) - coalesce(r.discount, 0),
         coalesce(r.gross, 0),
         coalesce(s.gross, 0) - coalesce(r.gross, 0) - (coalesce(s.commission, 0) - coalesce(r.commission, 0)) - (coalesce(s.discount, 0) - coalesce(r.discount, 0)),
         coalesce(p.paid, 0)
  from months mo
  left join sales s on s.m = mo.m
  left join refunds_ r on r.m = mo.m
  left join pay p on p.m = mo.m
  order by mo.m;
end $$;
grant execute on function admin_settlement_monthly() to authenticated;

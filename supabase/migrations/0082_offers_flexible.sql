-- Makes offers flexible (run after 0081; safe to run more than once):
--  * Who pays: each offer is funded by FasTrack (the supplier still gets the full price) or by a named supplier
--    (the discount on that supplier's items is taken off that supplier's settlement).
--  * Supplier scope: an offer can be limited to one supplier's products.
--  * Combining: an offer marked "can be combined" lets one more automatic offer apply on top of it
--    (for example a coupon code plus the automatic free delivery on a first order).
-- No blank lines inside function bodies.

alter table offers add column if not exists funded_by text not null default 'fastrack';
alter table offers drop constraint if exists offers_funded_by_check;
alter table offers add constraint offers_funded_by_check check (funded_by in ('fastrack', 'supplier'));
alter table offers add column if not exists store_id uuid references stores(id) on delete cascade;
alter table offers add column if not exists stackable boolean not null default false;
alter table offers drop constraint if exists offers_supplier_funded_check;
alter table offers add constraint offers_supplier_funded_check check (funded_by = 'fastrack' or store_id is not null);
alter table order_items add column if not exists supplier_discount numeric not null default 0;

create or replace function offer_check(p_offer uuid, p_lines jsonb, p_user uuid)
returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare
  o offers%rowtype;
  v_base jsonb;
  v_total numeric;
  v_elig numeric;
  v_disc numeric := 0;
  v_count int;
  v_flags jsonb;
begin
  select * into o from offers where id = p_offer;
  if not found or not o.is_active then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  v_base := jsonb_build_object('offer_id', o.id, 'name', o.name, 'name_ar', o.name_ar, 'code', o.code, 'kind', o.kind, 'funded_by', o.funded_by, 'store_id', o.store_id, 'stackable', o.stackable);
  if (o.starts_at is not null and o.starts_at > now()) or (o.ends_at is not null and o.ends_at < now()) then
    return v_base || jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
  select coalesce(sum((l->>'total')::numeric), 0) into v_total from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) l;
  if o.min_order is not null and v_total < o.min_order then
    return v_base || jsonb_build_object('ok', false, 'reason', 'min_order', 'min_order', o.min_order);
  end if;
  if o.usage_limit is not null then
    select count(*) into v_count from offer_redemptions r where r.offer_id = o.id;
    if v_count >= o.usage_limit then
      return v_base || jsonb_build_object('ok', false, 'reason', 'used_up');
    end if;
  end if;
  if p_user is not null and o.per_customer_limit is not null then
    select count(*) into v_count from offer_redemptions r where r.offer_id = o.id and r.user_id = p_user;
    if v_count >= o.per_customer_limit then
      return v_base || jsonb_build_object('ok', false, 'reason', 'used_by_you');
    end if;
  end if;
  if o.first_order_only and p_user is not null and exists (select 1 from orders x where x.user_id = p_user and x.status::text <> 'cancelled') then
    return v_base || jsonb_build_object('ok', false, 'reason', 'first_order_only');
  end if;
  if o.kind = 'free_delivery' then
    return v_base || jsonb_build_object('ok', true, 'discount', 0, 'free_delivery', true);
  end if;
  select coalesce(jsonb_agg(x.ok order by x.ord), '[]'::jsonb), coalesce(sum(case when x.ok then x.amt else 0 end), 0) into v_flags, v_elig
    from (select t.ord,
            ((o.category_id is null or coalesce(nullif(t.l->>'category_id', '')::uuid in (select c.id from categories c where c.id = o.category_id or c.parent_id = o.category_id), false))
             and (o.store_id is null or coalesce(nullif(t.l->>'store_id', '')::uuid = o.store_id, false))) as ok,
            (t.l->>'total')::numeric as amt
          from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) with ordinality as t(l, ord)) x;
  if v_elig <= 0 then
    return v_base || jsonb_build_object('ok', false, 'reason', 'no_eligible');
  end if;
  if o.kind = 'percent' then
    v_disc := round(v_elig * o.value / 100, 2);
    if o.max_discount is not null then
      v_disc := least(v_disc, o.max_discount);
    end if;
  else
    v_disc := least(o.value, v_elig);
  end if;
  return v_base || jsonb_build_object('ok', true, 'discount', v_disc, 'free_delivery', false, 'eligible', v_flags);
end;
$$;

create or replace function offer_quote(p_code text, p_lines jsonb)
returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare
  v_code text := nullif(upper(trim(coalesce(p_code, ''))), '');
  v_tenant uuid := current_tenant_id();
  v_id uuid;
  v_primary jsonb := null;
  v_extra jsonb := null;
  v_res jsonb;
  v_parts jsonb;
  r record;
begin
  if v_code is not null then
    select id into v_id from offers where tenant_id = v_tenant and upper(code) = v_code limit 1;
    if v_id is null then
      return jsonb_build_object('ok', false, 'reason', 'invalid');
    end if;
    v_primary := offer_check(v_id, p_lines, auth.uid());
    if not (v_primary->>'ok')::boolean then
      return v_primary;
    end if;
  else
    for r in select id from offers where tenant_id = v_tenant and is_active and auto_apply order by created_at loop
      v_res := offer_check(r.id, p_lines, auth.uid());
      if (v_res->>'ok')::boolean and (v_primary is null or (v_res->>'discount')::numeric > (v_primary->>'discount')::numeric) then
        v_primary := v_res;
      end if;
    end loop;
    if v_primary is null then
      return jsonb_build_object('ok', false, 'reason', 'none');
    end if;
  end if;
  if (v_primary->>'stackable')::boolean then
    for r in select id from offers where tenant_id = v_tenant and is_active and auto_apply and stackable and id <> (v_primary->>'offer_id')::uuid order by created_at loop
      v_res := offer_check(r.id, p_lines, auth.uid());
      if (v_res->>'ok')::boolean and not (v_res->>'kind' = 'free_delivery' and v_primary->>'kind' = 'free_delivery') and (v_extra is null or (v_res->>'discount')::numeric > (v_extra->>'discount')::numeric) then
        v_extra := v_res;
      end if;
    end loop;
  end if;
  v_parts := jsonb_build_array(v_primary);
  if v_extra is not null then
    v_parts := v_parts || jsonb_build_array(v_extra);
  end if;
  return jsonb_build_object('ok', true, 'parts', v_parts);
end;
$$;

-- Settlements: a discount a supplier funded comes off what that supplier is paid (commission is still worked out on the full price).
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
      coalesce(sales.gross_sales, 0) - coalesce(sales.commission, 0) - coalesce(sales.funded, 0),
      coalesce(payouts.paid_out, 0),
      coalesce(sales.gross_sales, 0) - coalesce(sales.commission, 0) - coalesce(sales.funded, 0) - coalesce(payouts.paid_out, 0),
      coalesce(sales.order_count, 0)
    from stores s
    left join lateral (
      select sum(oi.line_total) as gross_sales,
             sum(coalesce(oi.commission_amount, oi.line_total * s.commission_rate / 100)) as commission,
             sum(coalesce(oi.supplier_discount, 0)) as funded,
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
      coalesce(sales.gross_sales, 0) - coalesce(sales.commission, 0) - coalesce(sales.funded, 0),
      coalesce(payouts.paid_out, 0),
      coalesce(sales.gross_sales, 0) - coalesce(sales.commission, 0) - coalesce(sales.funded, 0) - coalesce(payouts.paid_out, 0),
      coalesce(sales.order_count, 0)
    from stores s
    left join lateral (
      select sum(oi.line_total) as gross_sales,
             sum(coalesce(oi.commission_amount, oi.line_total * s.commission_rate / 100)) as commission,
             sum(coalesce(oi.supplier_discount, 0)) as funded,
             count(distinct oi.order_id) as order_count
      from order_items oi
      join product_variants pv on pv.id = oi.variant_id
      join products p on p.id = pv.product_id
      join orders o on o.id = oi.order_id
      where p.store_id = s.id and o.status = 'delivered'
    ) sales on true
    left join lateral (select sum(sp.amount) as paid_out from settlement_payouts sp where sp.store_id = s.id) payouts on true
    order by (coalesce(sales.gross_sales, 0) - coalesce(sales.commission, 0) - coalesce(sales.funded, 0) - coalesce(payouts.paid_out, 0)) desc nulls last;
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
      sum(oi.line_total) - sum(coalesce(oi.commission_amount, oi.line_total * s.commission_rate / 100)) - sum(coalesce(oi.supplier_discount, 0))
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

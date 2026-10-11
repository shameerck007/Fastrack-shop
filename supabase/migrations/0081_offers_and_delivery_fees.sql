-- Delivery fees and offers controlled from the admin.
--  * company_settings: the Express / Standard delivery fee and the "free delivery over" amount per market (empty = the built-in default).
--  * offers: coupon codes and automatic offers (percent off, fixed amount off, free delivery) with a minimum order, a cap, dates, usage limits,
--    an optional category, and "first order only".
--  * offer_redemptions: one row per order that used an offer (usage limits and reports).
--  * offer_quote(code, lines): the one place that decides which offer applies and how much it takes off; checkout shows it and placing the order
--    re-checks it, so a price can never be edited in the browser.
-- Run the whole file in the Supabase SQL editor. Safe to run more than once. No blank lines inside function bodies.

alter table company_settings add column if not exists delivery_fee_express numeric check (delivery_fee_express is null or delivery_fee_express >= 0);
alter table company_settings add column if not exists delivery_fee_standard numeric check (delivery_fee_standard is null or delivery_fee_standard >= 0);
alter table company_settings add column if not exists free_delivery_over numeric check (free_delivery_over is null or free_delivery_over >= 0);
alter table company_settings add column if not exists free_delivery_enabled boolean not null default true;

create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id() references tenants(id),
  name text not null,
  name_ar text,
  code text,
  auto_apply boolean not null default false,
  kind text not null check (kind in ('percent', 'fixed', 'free_delivery')),
  value numeric not null default 0 check (value >= 0),
  max_discount numeric check (max_discount is null or max_discount >= 0),
  min_order numeric check (min_order is null or min_order >= 0),
  category_id uuid references categories(id) on delete set null,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit int check (usage_limit is null or usage_limit > 0),
  per_customer_limit int check (per_customer_limit is null or per_customer_limit > 0),
  first_order_only boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (kind = 'free_delivery' or value > 0),
  check (kind <> 'percent' or value <= 100),
  check (auto_apply or code is not null)
);
create unique index if not exists offers_code_uidx on offers (tenant_id, upper(code)) where code is not null;
create index if not exists offers_tenant_idx on offers (tenant_id, is_active);
alter table offers enable row level security;
drop policy if exists tenant_fence on offers;
create policy tenant_fence on offers as restrictive for all
  using (tenant_id = (select current_tenant_id()) or (select is_super_admin()))
  with check (tenant_id = (select current_tenant_id()) or (select is_super_admin()));
drop policy if exists "admins manage offers" on offers;
create policy "admins manage offers" on offers for all using ((select is_admin())) with check ((select is_admin()));

create table if not exists offer_redemptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default current_tenant_id() references tenants(id),
  offer_id uuid not null references offers(id) on delete cascade,
  order_id uuid references orders(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  amount numeric not null default 0,
  free_delivery boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists offer_redemptions_offer_idx on offer_redemptions (offer_id);
create index if not exists offer_redemptions_user_idx on offer_redemptions (user_id, offer_id);
alter table offer_redemptions enable row level security;
drop policy if exists tenant_fence on offer_redemptions;
create policy tenant_fence on offer_redemptions as restrictive for all
  using (tenant_id = (select current_tenant_id()) or (select is_super_admin()))
  with check (tenant_id = (select current_tenant_id()) or (select is_super_admin()));
drop policy if exists "admins read redemptions" on offer_redemptions;
create policy "admins read redemptions" on offer_redemptions for select using ((select is_admin()));
drop policy if exists "customers record their own redemption" on offer_redemptions;
create policy "customers record their own redemption" on offer_redemptions for insert with check (user_id = (select auth.uid()));

alter table orders add column if not exists offer_id uuid references offers(id) on delete set null;
alter table orders add column if not exists offer_code text;
alter table order_items add column if not exists discount_amount numeric not null default 0;

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
  v_base := jsonb_build_object('offer_id', o.id, 'name', o.name, 'name_ar', o.name_ar, 'code', o.code, 'kind', o.kind);
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
    from (select t.ord, (o.category_id is null or coalesce(nullif(t.l->>'category_id', '')::uuid in (select c.id from categories c where c.id = o.category_id or c.parent_id = o.category_id), false)) as ok, (t.l->>'total')::numeric as amt
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
  v_res jsonb;
  v_best jsonb := null;
  r record;
begin
  if v_code is not null then
    select id into v_id from offers where tenant_id = v_tenant and upper(code) = v_code limit 1;
    if v_id is null then
      return jsonb_build_object('ok', false, 'reason', 'invalid');
    end if;
    return offer_check(v_id, p_lines, auth.uid());
  end if;
  for r in select id from offers where tenant_id = v_tenant and is_active and auto_apply order by created_at loop
    v_res := offer_check(r.id, p_lines, auth.uid());
    if (v_res->>'ok')::boolean and (v_best is null or (v_res->>'discount')::numeric > (v_best->>'discount')::numeric) then
      v_best := v_res;
    end if;
  end loop;
  return coalesce(v_best, jsonb_build_object('ok', false, 'reason', 'none'));
end;
$$;
revoke execute on function offer_check(uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function offer_quote(text, jsonb) to authenticated;

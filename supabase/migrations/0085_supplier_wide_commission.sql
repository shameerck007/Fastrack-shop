-- A commission exception for a supplier with no category ("all of this supplier's products") was saved but never used by commission_rate_for.
-- Order of choice is now: a product rule, a supplier + category rule, a supplier-wide rule, a category rule (sub-categories inherit),
-- the supplier's older own rate, then the default. Safe to run more than once. No blank lines inside the function body.
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
  end if;
  select r.rate into v_rate from commission_rules r
    where r.tenant_id = v_tenant and r.is_active and r.store_id = p_store and r.master_id is null and r.category_id is null
      and (r.starts_on is null or r.starts_on <= p_on) and (r.ends_on is null or r.ends_on >= p_on)
    order by r.created_at desc limit 1;
  if found then
    return v_rate;
  end if;
  if p_category is not null then
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

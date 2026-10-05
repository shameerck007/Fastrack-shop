-- 1) New customers are registered in the market they signed up from.
--    The app passes it as signUp metadata `tenant_id`; only an ACTIVE tenant is accepted,
--    otherwise the default tenant is used. (Staff roles are never set from here.)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, full_name, phone, tenant_id)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone',
    coalesce(
      (select t.id from tenants t where t.status = 'active' and t.id::text = new.raw_user_meta_data ->> 'tenant_id'),
      (select t.id from tenants t where t.is_default limit 1)
    )
  );
  return new;
end;
$$;

-- 2) Live tracking across markets. Realtime does not carry the market header, so a customer
--    watching their rider would fall back to the default tenant and lose the rider's rows.
--    A customer may always read the rider (and assignment) of their own order.
drop policy if exists tenant_fence on delivery_partners;
create policy tenant_fence on delivery_partners as restrictive for all
  using (tenant_id = current_tenant_id() or is_super_admin() or is_my_orders_rider(id))
  with check (tenant_id = current_tenant_id() or is_super_admin());

drop policy if exists tenant_fence on delivery_assignments;
create policy tenant_fence on delivery_assignments as restrictive for all
  using (tenant_id = current_tenant_id() or is_super_admin() or owns_order(order_id))
  with check (tenant_id = current_tenant_id() or is_super_admin());

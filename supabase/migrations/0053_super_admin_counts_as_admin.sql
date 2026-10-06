-- The platform owner (super_admin) can do everything a tenant admin can, in every tenant
-- (the tenant rules already let super_admin see all tenants). Already applied to production.
create or replace function is_admin()
returns boolean as $f$
  select exists (select 1 from profiles where id = auth.uid() and role::text in ('admin', 'super_admin'));
$f$ language sql stable security definer set search_path = public;

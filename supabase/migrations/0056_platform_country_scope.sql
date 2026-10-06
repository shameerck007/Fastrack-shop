-- Platform owner (super_admin) can work inside ONE country at a time. The app sends the country in the
-- x-platform-country header on the /admin screens; with it, the owner is fenced to that country's
-- tenant like a staff member, and new rows land in it. Without it (the /platform console) nothing changes.
-- No blank lines inside functions (the Supabase SQL editor splits on them).
create or replace function is_platform_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role::text = 'super_admin');
$$;
create or replace function platform_scope_tenant()
returns uuid language sql stable security definer set search_path = public as $$
  select t.id from tenants t
  where is_platform_owner()
    and t.country_code = upper(nullif(current_setting('request.headers', true)::json ->> 'x-platform-country', ''))
  limit 1;
$$;
create or replace function is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select is_platform_owner() and platform_scope_tenant() is null;
$$;
create or replace function current_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    platform_scope_tenant(),
    (select p.tenant_id from profiles p where p.id = auth.uid() and p.role::text in ('admin', 'merchant', 'rider', 'store_staff')),
    (select t.id from tenants t
      where t.status = 'active'
        and t.id::text = nullif(current_setting('request.headers', true)::json ->> 'x-tenant-id', '')),
    (select t.id from tenants t where t.is_default limit 1)
  );
$$;
drop policy if exists "active tenants are public" on tenants;
create policy "active tenants are public" on tenants for select using (status = 'active' or is_platform_owner());
drop policy if exists "super admin manages tenants" on tenants;
create policy "super admin manages tenants" on tenants for all using (is_platform_owner()) with check (is_platform_owner());

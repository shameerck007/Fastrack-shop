-- The platform owner can create markets and change their status. (Already applied to production.)
drop policy if exists "super admin manages tenants" on tenants;
create policy "super admin manages tenants" on tenants for all using (is_super_admin()) with check (is_super_admin());

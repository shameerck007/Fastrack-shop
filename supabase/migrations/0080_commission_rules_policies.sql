-- Restores the access policies on commission_rules (table had row security on but no policy, so admins could neither read nor save rates).
-- Safe to run more than once.
alter table commission_rules enable row level security;
drop policy if exists tenant_fence on commission_rules;
create policy tenant_fence on commission_rules as restrictive for all
  using (tenant_id = (select current_tenant_id()) or (select is_super_admin()))
  with check (tenant_id = (select current_tenant_id()) or (select is_super_admin()));
drop policy if exists "admins manage commission rules" on commission_rules;
create policy "admins manage commission rules" on commission_rules for all using ((select is_admin())) with check ((select is_admin()));

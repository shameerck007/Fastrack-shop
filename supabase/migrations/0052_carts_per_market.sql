-- One cart per customer per market. Existing carts belong to the Saudi tenant.
-- The tenant rule below also scopes every cart query to the market the shopper is in,
-- so the app's existing cart code needs no changes.
alter table carts add column if not exists tenant_id uuid references tenants(id);
update carts set tenant_id = '00000000-0000-0000-0000-0000000000a1' where tenant_id is null;
alter table carts alter column tenant_id set default current_tenant_id();
alter table carts alter column tenant_id set not null;
alter table carts drop constraint if exists carts_user_id_key;
alter table carts add constraint carts_user_tenant_key unique (user_id, tenant_id);
create index if not exists carts_tenant_idx on carts (tenant_id);
drop policy if exists tenant_fence on carts;
create policy tenant_fence on carts as restrictive for all using (tenant_id = current_tenant_id() or is_super_admin()) with check (tenant_id = current_tenant_id() or is_super_admin());

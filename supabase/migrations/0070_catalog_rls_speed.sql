-- Catalog speed: the row policies on master_products and master_variants called current_tenant_id(), is_admin() and
-- is_super_admin() once per ROW. With ~13,500 catalog products that made a plain count take about 3 seconds (and the page hit the
-- database statement timeout). Wrapping each call in (select ...) makes Postgres evaluate it once per query instead.
-- Same rules, same access: only the speed changes (measured: 3,266 ms down to 7 ms for the same count).
-- Run the whole file in the Supabase SQL editor.

alter policy tenant_fence on master_products
  using (tenant_id = (select current_tenant_id()) or (select is_super_admin()))
  with check (tenant_id = (select current_tenant_id()) or (select is_super_admin()));

alter policy "admins manage catalog" on master_products
  using ((select is_admin()))
  with check ((select is_admin()));

alter policy "approved catalog is readable" on master_products
  using (
    (select is_admin())
    or status = 'approved'
    or exists (select 1 from stores s where s.id = master_products.requested_by_store and s.owner_id = (select auth.uid()))
  );

alter policy tenant_fence on master_variants
  using (tenant_id = (select current_tenant_id()) or (select is_super_admin()))
  with check (tenant_id = (select current_tenant_id()) or (select is_super_admin()));

alter policy "admins manage catalog variants" on master_variants
  using ((select is_admin()))
  with check ((select is_admin()));

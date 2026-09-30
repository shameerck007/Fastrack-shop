-- Amazon/noon-style marketplace invoicing: an order fulfilled from a
-- merchant's own warehouse should show that merchant's own trading name,
-- CR, and VAT number as the seller on the invoice/ZATCA QR — not
-- FasTrack's (company_settings). FasTrack-fulfilled orders (warehouse
-- belongs to no store) keep using company_settings, unchanged.
--
-- `stores` has no public select policy (cr_number/vat_number/bank_iban
-- are sensitive), so — same pattern as public_store_profile() in
-- 0019 — expose only the invoice-safe fields via a security-definer
-- function, keyed by warehouse_id (orders.warehouse_id is what invoice
-- generation already has on hand; same single-warehouse-per-order
-- simplification placeOrder already uses).
create or replace function get_store_billing_by_warehouse(target_warehouse_id uuid)
returns table (
  name text,
  cr_number text,
  vat_number text,
  address_line text,
  city text,
  contact_phone text
)
language sql
security definer
set search_path = public
stable
as $$
  select name, cr_number, vat_number, address_line, city, contact_phone
  from stores
  where warehouse_id = target_warehouse_id and status = 'approved';
$$;

grant execute on function get_store_billing_by_warehouse(uuid) to anon, authenticated;

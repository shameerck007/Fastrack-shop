-- India supplier onboarding.
--   stores.cr_number   holds the PAN for Indian suppliers (their registration identity)
--   stores.vat_number  holds the GSTIN
-- plus the extra identifiers and the bank details India pays out to (IFSC + account number
-- instead of an IBAN).
alter table stores
  add column if not exists fssai_number text,
  add column if not exists bank_account_number text,
  add column if not exists bank_ifsc text,
  add column if not exists bank_account_holder text;

-- Invoices need the seller's state (CGST+SGST vs IGST) and country.
drop function if exists get_store_billing_by_warehouse(uuid);
create function get_store_billing_by_warehouse(target_warehouse_id uuid)
returns table (
  name text,
  cr_number text,
  vat_number text,
  address_line text,
  city text,
  contact_phone text,
  state text,
  country text
)
language sql
security definer
set search_path = public
stable
as $$
  select name, cr_number, vat_number, address_line, city, contact_phone, state, country
  from stores
  where warehouse_id = target_warehouse_id and status = 'approved';
$$;
grant execute on function get_store_billing_by_warehouse(uuid) to anon, authenticated;

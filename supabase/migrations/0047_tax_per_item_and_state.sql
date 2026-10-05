-- Tax per item (India GST is 0 / 5 / 12 / 18 / 28 % by product; Saudi VAT is 15 %).
-- The rate and the tax amount are copied onto each order line when the order is placed, so an
-- invoice never changes if the product's rate is edited later.
alter table order_items
  add column if not exists tax_rate numeric,
  add column if not exists tax_amount numeric not null default 0,
  add column if not exists hsn_code text;

-- State of the delivery address and of the seller: GST is CGST + SGST when both are in the same
-- state and IGST when they differ (the PIN / postal code already has its own column).
alter table addresses add column if not exists state text;
alter table company_settings add column if not exists state text;
alter table stores add column if not exists state text;

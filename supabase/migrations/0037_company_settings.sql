-- FasTrack's own business/billing details — trading name, CR, VAT,
-- address, contact info — used on invoices and the ZATCA QR code. Was
-- previously hardcoded as placeholder constants directly in
-- src/lib/invoice-pdf.ts and src/lib/zatca.ts (the latter with a code
-- comment flagging the VAT number as fake and "not a valid tax document"
-- until replaced). Single-row table, same fixed-id singleton convention
-- default_warehouse_id() already uses elsewhere in this schema.

create table company_settings (
  id uuid primary key default '00000000-0000-0000-0000-000000000001',
  trading_name text not null default 'FasTrack Shop',
  cr_number text,
  vat_number text,
  address_line text,
  city text,
  district text,
  postal_code text,
  phone text,
  email text,
  updated_at timestamptz not null default now()
);

insert into company_settings (id) values ('00000000-0000-0000-0000-000000000001');

alter table company_settings enable row level security;

-- Public read: a business's own trading name/CR/VAT is exactly what
-- already appears on every customer-facing invoice — no privacy concern,
-- and the invoice-generation route runs as the customer, not an admin.
create policy "company settings are publicly readable" on company_settings for select using (true);
create policy "admins manage company settings" on company_settings for all using (is_admin()) with check (is_admin());

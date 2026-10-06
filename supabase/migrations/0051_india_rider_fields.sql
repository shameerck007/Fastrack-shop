-- India rider onboarding: Aadhaar / PAN as the identity document, and bank account + IFSC for payouts.
alter table delivery_partners drop constraint if exists delivery_partners_id_type_check;
alter table delivery_partners add constraint delivery_partners_id_type_check check (id_type is null or id_type in ('national_id', 'iqama', 'aadhaar', 'pan'));
alter table delivery_partners add column if not exists bank_account_number text;
alter table delivery_partners add column if not exists bank_ifsc text;

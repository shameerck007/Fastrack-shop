-- The delivery time promised when the order was placed: the real estimate worked out from the distance (Express) or the shop's
-- Standard delivery days, saved on the order so emails and order pages show the same time the customer was told.
-- Run the whole file in the Supabase SQL editor.

alter table orders add column if not exists promised_eta_minutes int check (promised_eta_minutes is null or promised_eta_minutes between 1 and 1440);
alter table orders add column if not exists estimated_delivery_at timestamptz;

-- Scanning options, set per market by the admin (Business settings > Scanning):
--  * require_pickup_scan   a rider must scan the parcel label (or type the order number) to confirm pickup; the server checks it matches the order.
--  * require_pack_scan     warehouse staff must scan or tick every item before an order can be marked ready for pickup.
-- Both default to off, so scanning is available but optional until you require it.
-- Run in the Supabase SQL editor. Safe to run more than once.

alter table company_settings add column if not exists require_pickup_scan boolean not null default false;
alter table company_settings add column if not exists require_pack_scan boolean not null default false;

-- New suppliers and FasTrack shops start with Standard delivery OFF. An admin turns it on (and sets the delivery area) in Admin > Delivery zones.
-- Existing shops keep whatever they have today.
alter table warehouses alter column standard_delivery_enabled set default false;

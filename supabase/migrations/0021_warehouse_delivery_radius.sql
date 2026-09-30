-- Delivery boundary per warehouse (each merchant store has its own
-- warehouse; FasTrack's own dark store is the default one). The boundary is
-- a circle: warehouses.lat/lng is the centre, this is the radius in km.
-- NULL = no boundary set, i.e. unrestricted, so existing warehouses keep
-- working until an admin configures them.
alter table warehouses add column delivery_radius_km numeric(6,2)
  check (delivery_radius_km is null or delivery_radius_km > 0);

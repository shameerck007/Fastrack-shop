-- Delivery time estimate settings, per market (Admin > Business settings). Defaults: 10 min to pack,
-- 20 km/h average rider speed, 5 min for the rider to reach the store.
alter table company_settings add column if not exists prep_minutes int not null default 10 check (prep_minutes between 0 and 120);
alter table company_settings add column if not exists rider_speed_kmh numeric not null default 20 check (rider_speed_kmh between 5 and 80);
alter table company_settings add column if not exists eta_buffer_minutes int not null default 5 check (eta_buffer_minutes between 0 and 60);

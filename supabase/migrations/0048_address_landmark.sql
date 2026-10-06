-- Indian addresses use a landmark ("near City Mall") to help riders find the place.
-- (State is added in 0047; the PIN code uses the existing postal_code column.)
alter table addresses add column if not exists landmark text;

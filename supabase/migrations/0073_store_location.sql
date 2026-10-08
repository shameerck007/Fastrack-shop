-- The shop's pin on the map, set by the supplier when they apply. When the shop is approved its pickup point (warehouse) starts at this
-- pin, so delivery areas and times are measured from the real shop. Run the whole file in the Supabase SQL editor.

alter table stores add column if not exists lat double precision check (lat is null or (lat between -90 and 90));
alter table stores add column if not exists lng double precision check (lng is null or (lng between -180 and 180));

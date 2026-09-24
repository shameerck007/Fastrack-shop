-- Saudi National Address fields — building number, additional number
-- (secondary/unit code), district and postal code are the standard fields
-- used by SPL (Saudi Post) for precise delivery addressing. All optional so
-- existing rows and quick "just a text line" entry both keep working.
alter table addresses add column district text;
alter table addresses add column building_number text;
alter table addresses add column additional_number text;
alter table addresses add column unit_number text;
alter table addresses add column postal_code text;
alter table addresses add column short_address text;

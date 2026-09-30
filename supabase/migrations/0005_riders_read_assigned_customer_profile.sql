-- Let a rider see the name/phone of the customer on an order assigned to
-- them (for the "Call customer" button), without exposing profiles broadly.
--
-- Note: 0001_init.sql has already been updated in place with this policy
-- for anyone applying the schema fresh. This migration exists to bring an
-- already-migrated database (this project) up to date the same way.
create policy "assigned riders read customer profile" on profiles for select using (
  exists (
    select 1 from orders o where o.user_id = profiles.id and is_assigned_rider(o.id)
  )
);

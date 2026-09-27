-- Who to hand the order to at this address (may differ from the account
-- holder). Nullable so addresses saved before this migration keep working;
-- the UI requires both for new/edited addresses.
alter table addresses add column receiver_name text, add column receiver_phone text;

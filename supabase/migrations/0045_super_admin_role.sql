-- The platform-owner role. Run this on its own (a new enum value cannot be used in the same
-- transaction that adds it). Nothing needs it until the Super Admin dashboard is built; to make
-- yourself the platform owner afterwards:
--   update profiles set role = 'super_admin' where id = '<your user id>';
alter type user_role add value if not exists 'super_admin';

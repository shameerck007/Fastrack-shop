-- profiles never had an admin-update policy — only "auth.uid() = id" (self).
-- approveStore's role promotion (customer -> merchant) silently affected 0
-- rows because of this: no error, since RLS just filters the row out rather
-- than raising. Found by testing the merchant approval flow end to end.
--
-- Note: 0001_init.sql has already been updated in place with the fixed
-- policy for anyone applying the schema fresh. This migration exists to
-- bring an already-migrated database (this project) up to date the same way.
drop policy "users update own profile" on profiles;
create policy "users and admins update profile" on profiles for update using (
  auth.uid() = id or is_admin()
) with check (
  auth.uid() = id or is_admin()
);

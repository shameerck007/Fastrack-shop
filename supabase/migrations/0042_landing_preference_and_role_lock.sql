-- 1) Landing page preference. Riders, suppliers (merchants), admins and
--    warehouse staff open their own portal by default and can switch to the
--    shopping page from their account settings.
alter table profiles
  add column if not exists landing_page text not null default 'portal'
  check (landing_page in ('portal', 'shop'));

-- 2) SECURITY FIX: the "users and admins update profile" policy lets a user
--    update their own row, and `authenticated` holds UPDATE on every column
--    including `role` — so any signed-in user could promote themselves to
--    admin straight from the browser. Roles may only be changed by an admin
--    (approve/promote flows run as admin) or by the service role
--    (auth.uid() is null there).
create or replace function protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not is_admin() then
    raise exception 'Only an admin can change a user''s role.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on profiles;
create trigger profiles_protect_role
  before update on profiles
  for each row execute function protect_profile_role();

-- Lets the login screen check whether an email has an account (called with the service-role key only).
create or replace function auth_email_exists(target_email text)
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select exists (select 1 from auth.users where lower(email) = lower(target_email));
$$;
revoke all on function auth_email_exists(text) from public, anon, authenticated;
grant execute on function auth_email_exists(text) to service_role;

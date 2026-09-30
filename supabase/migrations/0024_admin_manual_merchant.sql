-- Lets an admin add a merchant directly (without the applicant going
-- through the self-serve apply flow) and record which country the store
-- operates in, for the admin merchant list's country filter.
alter table stores add column country text not null default 'Saudi Arabia';

-- Admin-only lookup of an existing registered user by email, so an admin
-- can create a store for someone who already has a customer account
-- without needing the Supabase service-role key (auth.users isn't
-- reachable from RLS-scoped client roles otherwise).
create or replace function admin_find_user_by_email(p_email text)
returns table (id uuid, full_name text, role text, has_store boolean)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not is_admin() then
    raise exception 'Only admins can look up users.';
  end if;

  return query
    select p.id, p.full_name, p.role::text,
           exists (select 1 from stores s where s.owner_id = p.id) as has_store
    from profiles p
    join auth.users u on u.id = p.id
    where lower(u.email) = lower(p_email)
    limit 1;
end;
$$;

grant execute on function admin_find_user_by_email(text) to authenticated;

-- Admin-only: the registered email for a store's owner, for the merchant
-- detail view.
create or replace function admin_get_user_email(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not is_admin() then
    raise exception 'Only admins can look up users.';
  end if;

  return (select email from auth.users where id = p_user_id);
end;
$$;

grant execute on function admin_get_user_email(uuid) to authenticated;

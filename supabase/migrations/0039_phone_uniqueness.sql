-- Prevent two accounts sharing the same mobile number. Phone stays
-- optional (null/empty excluded from the index so multiple blank phones
-- don't collide), but once set it must be unique.
create unique index profiles_phone_unique_idx on profiles (phone) where phone is not null and phone <> '';

-- RLS on profiles restricts reads to your own row (or admin), so a
-- registration form can't just SELECT to check if a phone is taken —
-- this exposes only a yes/no answer, never whose account owns it, same
-- safe-exposure pattern as is_admin()/public_store_profile(). exclude_user_id
-- lets an existing user re-save their own unchanged number without it
-- flagging against itself.
create or replace function is_phone_registered(target_phone text, exclude_user_id uuid default null)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles
    where phone = target_phone
      and (exclude_user_id is null or id <> exclude_user_id)
  );
$$;

grant execute on function is_phone_registered(text, uuid) to anon, authenticated;

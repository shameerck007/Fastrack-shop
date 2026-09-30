-- Email sending (order confirmations, status updates, new-order/
-- new-application alerts) needs the recipient's actual email address,
-- which lives in auth.users, not profiles. Server-side trigger code
-- computes the target user_ids itself (the order's customer, a store's
-- staff, every admin) and isn't necessarily running as an admin session —
-- same "a request only carries its own user's session" gap the existing
-- SECURITY DEFINER helpers (push_subscriptions_for_users, etc., 0033)
-- solve, here for auth.users.email instead of push_subscriptions.
create or replace function user_emails_for(target_user_ids uuid[])
returns table (user_id uuid, email text)
language sql
security definer
set search_path = public
stable
as $$
  select id, email from auth.users where id = any(target_user_ids);
$$;

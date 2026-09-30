-- Web Push subscriptions: one row per browser/device a signed-in user has
-- granted notification permission on (a user can have several — phone +
-- desktop). Endpoint is unique per push service registration, so re-
-- subscribing the same device (e.g. after clearing site data) just
-- upserts rather than accumulating stale duplicates.

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;

-- A subscription is written by the owning user's own browser (subscribe)
-- and read only by server-side code sending pushes — that path uses the
-- request's own user session (RLS still applies) when sending to a single
-- user, but cross-user sends (e.g. "notify every online rider nearby",
-- "notify all admins") need a SECURITY DEFINER function since no single
-- request is "logged in as" every recipient at once.
create policy "users manage their own push subscriptions" on push_subscriptions for all using (
  user_id = auth.uid()
) with check (
  user_id = auth.uid()
);

-- Server-side push sending needs to read subscriptions for OTHER users
-- (the order's customer, a store's staff, nearby riders, every admin) —
-- exactly the same "a request only carries its own user's session" gap
-- the existing SECURITY DEFINER helpers (is_admin, my_staff_warehouse_id,
-- ...) solve elsewhere in this schema.
create or replace function push_subscriptions_for_users(target_user_ids uuid[])
returns table (user_id uuid, endpoint text, p256dh text, auth text)
language sql
security definer
set search_path = public
stable
as $$
  select user_id, endpoint, p256dh, auth
  from push_subscriptions
  where user_id = any(target_user_ids);
$$;

create or replace function push_subscriptions_for_admins()
returns table (user_id uuid, endpoint text, p256dh text, auth text)
language sql
security definer
set search_path = public
stable
as $$
  select ps.user_id, ps.endpoint, ps.p256dh, ps.auth
  from push_subscriptions ps
  join profiles p on p.id = ps.user_id
  where p.role = 'admin';
$$;

-- A subscription that the push service has reported as gone (404/410) is
-- deleted by server code, which isn't "logged in as" that subscriber —
-- same reasoning as the read-side functions above.
create or replace function delete_push_subscription(target_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from push_subscriptions where endpoint = target_endpoint;
$$;

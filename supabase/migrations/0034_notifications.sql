-- In-app notification history/fallback alongside push (0033) — push can
-- fail silently (permission never granted, OS notification dismissed
-- unseen, iOS Safari not installed to Home Screen, ...); this table lets
-- every role see the same events inside the app itself via a bell icon,
-- independent of whether the push actually got delivered.

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text not null,
  url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on notifications(user_id, created_at desc);

alter table notifications enable row level security;

create policy "users read own notifications" on notifications for select using (
  user_id = auth.uid()
);
create policy "users mark own notifications read" on notifications for update using (
  user_id = auth.uid()
) with check (
  user_id = auth.uid()
);

-- Written by system/trigger code (order placed, status changed, an
-- application submitted), which needs to target a DIFFERENT user than
-- whoever's request is running — same SECURITY DEFINER pattern as
-- push_subscriptions_for_users/_for_admins (0033).
create or replace function create_notifications(target_user_ids uuid[], p_title text, p_body text, p_url text default null)
returns void
language sql
security definer
set search_path = public
as $$
  insert into notifications (user_id, title, body, url)
  select id, p_title, p_body, p_url from unnest(target_user_ids) as id;
$$;

create or replace function admin_user_ids()
returns table (user_id uuid)
language sql
security definer
set search_path = public
stable
as $$
  select id from profiles where role = 'admin';
$$;

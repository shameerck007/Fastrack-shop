-- Passkeys: sign in with the phone's own face, fingerprint, PIN or pattern (WebAuthn). The phone does the checking; we keep only the
-- passkey's PUBLIC key (it cannot be used to sign in without the phone) and a counter.
--  * user_passkeys: one row per saved device/passkey. The shopper can see and remove their own; rows are added by the server only,
--    after it has checked the phone's proof.
--  * passkey_challenges: one-time random values the server hands out before each sign-in or registration, so an old proof cannot be
--    replayed. Server only (no policies, so the app's normal access cannot read it); expired rows are cleared as new ones are made.
-- Safe to run more than once.

create table if not exists user_passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  algorithm int not null,
  counter bigint not null default 0,
  transports text[] not null default '{}',
  device_name text not null default 'This device',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists user_passkeys_user_idx on user_passkeys (user_id);
alter table user_passkeys enable row level security;
drop policy if exists "own passkeys" on user_passkeys;
create policy "own passkeys" on user_passkeys for select using (user_id = (select auth.uid()));
drop policy if exists "remove own passkey" on user_passkeys;
create policy "remove own passkey" on user_passkeys for delete using (user_id = (select auth.uid()));
-- The public key itself is never sent to the browser: the app reads only these columns.
revoke select on user_passkeys from anon, authenticated;
grant select (id, user_id, credential_id, device_name, created_at, last_used_at) on user_passkeys to authenticated;

create table if not exists passkey_challenges (
  id uuid primary key default gen_random_uuid(),
  challenge text not null,
  purpose text not null check (purpose in ('register', 'login', 'unlock')),
  user_id uuid references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '5 minutes')
);
alter table passkey_challenges enable row level security;

-- Keeta-style supplier pages: a logo/cover/tagline per store, weekly opening
-- hours, and a "pause orders" switch. Ordering from a closed or paused
-- store is blocked (see lib/stores.ts) — null opening_hours means open all
-- day, every day, so existing stores keep working until they set hours.
--
-- opening_hours shape (keys are weekdays, 0 = Sunday ... 6 = Saturday, times
-- are 24h "HH:MM" in Asia/Riyadh; close earlier than open means it runs past
-- midnight):
--   {"0": {"closed": false, "open": "09:00", "close": "23:00"}, "5": {"closed": true, ...}, ...}

alter table stores
  add column logo_url text,
  add column cover_url text,
  add column tagline text,
  add column opening_hours jsonb,
  add column accepting_orders boolean not null default true;

-- `stores` has no public select policy (CR/VAT/IBAN live there), so expose
-- only the storefront-safe fields of every approved store via a
-- security-definer function — same pattern as public_store_profile().
create or replace function public_store_directory()
returns table (
  id uuid,
  name text,
  city text,
  logo_url text,
  cover_url text,
  tagline text,
  opening_hours jsonb,
  accepting_orders boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select id, name, city, logo_url, cover_url, tagline, opening_hours, accepting_orders
  from stores
  where status = 'approved';
$$;

grant execute on function public_store_directory() to anon, authenticated;

-- Owners can't update their store once it's approved (RLS only lets them
-- edit while pending), but logo, hours and the pause switch are theirs to
-- manage. This touches only those columns, only on the caller's own store.
create or replace function update_own_store_profile(
  p_logo_url text,
  p_cover_url text,
  p_tagline text,
  p_opening_hours jsonb,
  p_accepting_orders boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update stores
  set logo_url = p_logo_url,
      cover_url = p_cover_url,
      tagline = nullif(trim(p_tagline), ''),
      opening_hours = p_opening_hours,
      accepting_orders = p_accepting_orders
  where owner_id = auth.uid() and status in ('pending', 'approved');
  if not found then
    raise exception 'No store found for this account.';
  end if;
end;
$$;

grant execute on function update_own_store_profile(text, text, text, jsonb, boolean) to authenticated;

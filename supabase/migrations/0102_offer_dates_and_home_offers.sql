-- 1. A "was" price can have an end date. When it passes, the old price is cleared by an hourly job, so every screen
--    (cards, product page, search, home Offers row) stops showing the discount without each one checking the date.
-- 2. public_offers(): the admin offers a shopper may see on the home page (active, in date, not used up).
--    Customers cannot read the offers table directly, so this security-definer function returns only safe fields
--    (never the usage counters, the funder or the creator). Code-only coupons are included with their code on purpose:
--    a coupon shown on the home page is a public promotion; an admin who wants a private code simply leaves it unlisted.
-- Safe to run more than once.

alter table product_variants add column if not exists compare_at_until timestamptz;

create or replace function expire_was_prices() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update product_variants set compare_at_price = null, compare_at_until = null
  where compare_at_until is not null and compare_at_until < now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function expire_was_prices() from public, anon, authenticated;

create extension if not exists pg_cron;
do $$
begin
  perform cron.unschedule('expire-was-prices') where exists (select 1 from cron.job where jobname = 'expire-was-prices');
  perform cron.schedule('expire-was-prices', '5 * * * *', 'select public.expire_was_prices()');
end $$;

alter table offers add column if not exists show_on_home boolean not null default true;

create or replace function public_offers()
returns table (id uuid, name text, name_ar text, code text, auto_apply boolean, kind text, value numeric, max_discount numeric,
               min_order numeric, category_id uuid, category_slug text, store_id uuid, ends_at timestamptz, first_order_only boolean)
language sql stable security definer set search_path = public as $$
  select o.id, o.name, o.name_ar, o.code, o.auto_apply, o.kind, o.value, o.max_discount, o.min_order, o.category_id, c.slug, o.store_id,
         o.ends_at, o.first_order_only
  from offers o
  left join categories c on c.id = o.category_id
  where o.is_active and o.show_on_home
    and o.tenant_id = current_tenant_id()
    and (o.starts_at is null or o.starts_at <= now())
    and (o.ends_at is null or o.ends_at >= now())
    and (o.usage_limit is null or (select count(*) from offer_redemptions r where r.offer_id = o.id) < o.usage_limit)
  order by o.ends_at nulls last, o.created_at desc
  limit 6
$$;
grant execute on function public_offers() to anon, authenticated;

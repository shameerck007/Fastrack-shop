-- Public store storefronts (QR-code feature): anyone scanning a store's QR
-- code must be able to resolve /store/[id] without being signed in. The
-- `stores` table intentionally has no public select policy (it holds
-- cr_number/vat_number/bank_iban), so a plain RLS policy would either leak
-- those columns or require one. Instead, expose only the safe, storefront
-- fields via a security-definer function.

create or replace function public_store_profile(target_store_id uuid)
returns table (id uuid, name text, city text)
language sql
security definer
set search_path = public
stable
as $$
  select id, name, city
  from stores
  where id = target_store_id and status = 'approved';
$$;

grant execute on function public_store_profile(uuid) to anon, authenticated;

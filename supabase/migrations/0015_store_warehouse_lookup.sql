-- placeOrder needs to resolve which warehouse fulfills a merchant product,
-- but the `stores` table's RLS restricts reads to the store's own owner (or
-- admin) — a customer checking out has no access, which made the mixed-cart
-- warehouse fix throw "isn't available from its seller right now" for every
-- merchant item. This exposes only the one thing checkout actually needs
-- (store id -> warehouse id, and only for approved stores), nothing else on
-- the stores row (CR number, VAT, bank IBAN, contact phone stay protected).
create or replace function get_store_warehouses(target_store_ids uuid[])
returns table(store_id uuid, warehouse_id uuid) as $$
  select id, warehouse_id from stores where id = any(target_store_ids) and status = 'approved';
$$ language sql stable security definer set search_path = public;

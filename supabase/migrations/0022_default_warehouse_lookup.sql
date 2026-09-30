-- Which warehouse fulfils products that don't belong to a merchant store:
-- the first active warehouse that no store owns. Stores' own RLS hides the
-- store->warehouse link from customers, so this is a security-definer
-- lookup returning only that one id. Used by the delivery-boundary checks.
create or replace function default_warehouse_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select w.id from warehouses w
  where w.is_active and not exists (select 1 from stores s where s.warehouse_id = w.id)
  order by w.created_at
  limit 1;
$$;
grant execute on function default_warehouse_id() to anon, authenticated;

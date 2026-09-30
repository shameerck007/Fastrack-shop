-- Mirror of decrement_stock (0008_decrement_stock_function.sql) for the
-- reverse operation: restoring inventory when a placed order is cancelled.
-- placeOrder (orders.ts) decrements stock per line item via decrement_stock;
-- until now, cancelling an order never gave that stock back.
create or replace function increment_stock(p_variant_id uuid, p_warehouse_id uuid, p_qty numeric)
returns void as $$
begin
  update inventory
  set stock = stock + p_qty
  where variant_id = p_variant_id
    and warehouse_id = p_warehouse_id;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function increment_stock(uuid, uuid, numeric) to authenticated;

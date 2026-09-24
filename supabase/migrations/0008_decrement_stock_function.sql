-- Atomic, race-safe stock decrement for checkout. A conditional UPDATE
-- (stock >= qty in the WHERE clause) is used instead of read-then-write
-- from the application, so two concurrent checkouts can't both succeed
-- against the same last unit. Raises if there isn't enough stock, which
-- the caller surfaces as a checkout error.
--
-- Note: 0001_init.sql has already been updated in place with this function
-- for anyone applying the schema fresh. This migration exists to bring an
-- already-migrated database (this project) up to date the same way.
create or replace function decrement_stock(p_variant_id uuid, p_warehouse_id uuid, p_qty numeric)
returns void as $$
declare
  updated_rows int;
begin
  update inventory
  set stock = stock - p_qty
  where variant_id = p_variant_id
    and warehouse_id = p_warehouse_id
    and stock >= p_qty;

  get diagnostics updated_rows = row_count;
  if updated_rows = 0 then
    raise exception 'insufficient_stock' using errcode = 'P0001';
  end if;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function decrement_stock(uuid, uuid, numeric) to authenticated;

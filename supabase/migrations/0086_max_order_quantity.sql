-- Maximum order quantity: a product can carry a limit on how many units one order may hold (per variant), set by the supplier for their
-- own products and by the admin for FasTrack's. Empty = no limit. The shop checks it when adding to the cart and at checkout; these
-- triggers are the last line, so the limit holds even if something calls the database directly.
-- Safe to run more than once. No blank lines inside function bodies.

alter table products add column if not exists max_order_qty int check (max_order_qty is null or max_order_qty > 0);

create or replace function enforce_max_order_qty_cart()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_max int;
  v_name text;
begin
  select p.max_order_qty, p.name into v_max, v_name from product_variants pv join products p on p.id = pv.product_id where pv.id = new.variant_id;
  if v_max is not null and new.quantity > v_max then
    raise exception 'You can buy up to % of "%" per order.', v_max, v_name;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_max_order_qty_cart on cart_items;
create trigger trg_max_order_qty_cart before insert or update of quantity on cart_items for each row execute function enforce_max_order_qty_cart();

create or replace function enforce_max_order_qty_order()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_max int;
  v_name text;
begin
  select p.max_order_qty, p.name into v_max, v_name from product_variants pv join products p on p.id = pv.product_id where pv.id = new.variant_id;
  if v_max is not null and new.ordered_quantity > v_max then
    raise exception 'You can buy up to % of "%" per order.', v_max, v_name;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_max_order_qty_order on order_items;
create trigger trg_max_order_qty_order before insert on order_items for each row execute function enforce_max_order_qty_order();

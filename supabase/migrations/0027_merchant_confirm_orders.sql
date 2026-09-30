-- 0026 let a merchant advance confirmed->preparing->ready_for_pickup, but
-- pending->confirmed was still admin-only, so every order still needed a
-- human in Control Center to rubber-stamp it before the merchant could even
-- start packing. There's no real check happening at that step (stock is
-- already decremented at checkout, and COD is the only payment method, so
-- there's nothing left to verify) — it's pure friction. This extends the
-- same one-step-at-a-time policy to let a merchant confirm their own orders
-- too, same as accepting an order on Swiggy/Amazon Seller Central.
drop policy "merchants advance their orders to ready for pickup" on orders;
create policy "merchants advance their orders to ready for pickup" on orders for update using (
  order_has_my_store_item(id) and status in ('pending', 'confirmed', 'preparing')
) with check (
  order_has_my_store_item(id) and status in ('confirmed', 'preparing', 'ready_for_pickup')
);

drop policy "merchants log their own order status changes" on order_status_history;
create policy "merchants log their own order status changes" on order_status_history for insert with check (
  order_has_my_store_item(order_id) and status in ('confirmed', 'preparing', 'ready_for_pickup')
);

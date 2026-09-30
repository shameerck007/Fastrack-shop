-- A warehouse-staff account can also be an ordinary customer of that same
-- warehouse (e.g. an existing shopper promoted to staff for their local
-- FasTrack location). The 0031 policies scoped staff visibility to
-- "warehouse_id = my_staff_warehouse_id()" only, with no exclusion for
-- orders they placed themselves — so a staff member could see, and even
-- advance, their own personal order in their professional orders queue.
-- Same conflict-of-interest problem as a cashier ringing up their own
-- purchase. Excluding self-placed orders from every staff-facing policy
-- closes this for orders, their items, their status history, and the
-- advance-status action.

drop policy "warehouse staff view their warehouse orders" on orders;
create policy "warehouse staff view their warehouse orders" on orders for select using (
  warehouse_id = my_staff_warehouse_id() and user_id <> auth.uid()
);

drop policy "warehouse staff advance their orders" on orders;
create policy "warehouse staff advance their orders" on orders for update using (
  warehouse_id = my_staff_warehouse_id() and user_id <> auth.uid() and status in ('pending', 'confirmed', 'preparing')
) with check (
  warehouse_id = my_staff_warehouse_id() and user_id <> auth.uid() and status in ('confirmed', 'preparing', 'ready_for_pickup')
);

drop policy "warehouse staff view their warehouse order items" on order_items;
create policy "warehouse staff view their warehouse order items" on order_items for select using (
  exists (
    select 1 from orders o
    where o.id = order_items.order_id and o.warehouse_id = my_staff_warehouse_id() and o.user_id <> auth.uid()
  )
);

drop policy "warehouse staff view their warehouse order history" on order_status_history;
create policy "warehouse staff view their warehouse order history" on order_status_history for select using (
  exists (
    select 1 from orders o
    where o.id = order_status_history.order_id and o.warehouse_id = my_staff_warehouse_id() and o.user_id <> auth.uid()
  )
);

drop policy "warehouse staff log their order status changes" on order_status_history;
create policy "warehouse staff log their order status changes" on order_status_history for insert with check (
  exists (
    select 1 from orders o
    where o.id = order_status_history.order_id and o.warehouse_id = my_staff_warehouse_id() and o.user_id <> auth.uid()
  )
  and status in ('confirmed', 'preparing', 'ready_for_pickup')
);

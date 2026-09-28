-- Merchants could see orders containing their products (0014) but had no way
-- to signal they've packed one — only an admin could ever move an order's
-- status forward, so every order sat waiting on a human in Control Center to
-- notice and click through pending -> confirmed -> preparing ->
-- ready_for_pickup before a rider could even see it in their pickup pool.
--
-- This lets a store owner move an order they have items in forward by
-- exactly one step, and only within the "packing" stages -- confirmed ->
-- preparing, or preparing/confirmed -> ready_for_pickup. It intentionally
-- excludes rider_assigned/out_for_delivery/delivered/cancelled and any other
-- store's items' status: a merchant can say "I'm done packing", nothing else.
--
-- WITH CHECK re-validates order_has_my_store_item on the new row too (the
-- row's identity doesn't change on an UPDATE, but this keeps the policy
-- correct if a future edit ever widens the USING clause).
create policy "merchants advance their orders to ready for pickup" on orders for update using (
  order_has_my_store_item(id) and status in ('confirmed', 'preparing')
) with check (
  order_has_my_store_item(id) and status in ('preparing', 'ready_for_pickup')
);

-- The status update above is logged to order_status_history for the same
-- audit trail admins/riders already write to; merchants had select-only
-- access to it (0014) and no insert policy, so without this the history
-- write in advanceMerchantOrderStatus would fail RLS right after the order
-- row itself was already (successfully) updated. Scoped the same way as the
-- update above -- only for their own orders, only the two packing statuses.
create policy "merchants log their own order status changes" on order_status_history for insert with check (
  order_has_my_store_item(order_id) and status in ('preparing', 'ready_for_pickup')
);

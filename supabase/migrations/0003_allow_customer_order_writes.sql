-- Checkout inserts order_items, order_status_history, and payments rows as
-- the customer (not an admin), but those tables previously only had
-- admin-scoped insert policies (error 42501: insufficient_privilege).
-- Add customer insert policies scoped to orders they own.

create policy "users insert own order items" on order_items for insert with check (
  exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid())
);

create policy "users insert own order history" on order_status_history for insert with check (
  exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid())
);

create policy "users insert own payments" on payments for insert with check (
  exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid())
);

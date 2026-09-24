-- Merchants previously had zero visibility into orders containing their
-- products — no way to know if/when something sold. SECURITY DEFINER here
-- for the same reason as is_assigned_rider/is_order_owner: this checks
-- order_items -> product_variants -> products -> stores, so an inline EXISTS
-- subquery in the orders/order_items policies would make Postgres evaluate
-- RLS on those other tables while evaluating this one, recursing (42P17).
create or replace function order_has_my_store_item(target_order_id uuid)
returns boolean as $$
  select exists (
    select 1
    from order_items oi
    join product_variants pv on pv.id = oi.variant_id
    join products p on p.id = pv.product_id
    join stores s on s.id = p.store_id
    where oi.order_id = target_order_id and s.owner_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

create policy "merchants view orders containing their products" on orders for select using (
  order_has_my_store_item(id)
);

-- Per-item, not per-order: an order can mix products from several sellers,
-- and a merchant should only ever see their own line items in it, not a
-- co-seller's.
create policy "merchants view their order items" on order_items for select using (
  exists (
    select 1 from product_variants pv
    join products p on p.id = pv.product_id
    join stores s on s.id = p.store_id
    where pv.id = order_items.variant_id and s.owner_id = auth.uid()
  )
);

create policy "merchants view order history for their orders" on order_status_history for select using (
  order_has_my_store_item(order_id)
);

-- Speed-ups found by a performance check:
--  1. Missing indexes on the columns the shop and supplier screens join and filter by most (a supplier's own products, an order's
--     items and history, a shopper's addresses, the stock of a warehouse...). Indexes only make reads faster; nothing changes in what is stored.
--  2. The catalog search function (used by the supplier "Product catalog" and "Add from catalog") took about 0.7 s for the plain list of
--     13,000+ products because it built every product's details before sorting and keeping the first 36. It now picks the 36 first
--     (using the name index when nothing is typed) and builds the details only for those. Same answers, same shape.
-- Safe to run more than once.

create index if not exists products_store_idx on products (store_id);
create index if not exists order_items_order_idx on order_items (order_id);
create index if not exists order_items_variant_idx on order_items (variant_id);
create index if not exists order_status_history_order_idx on order_status_history (order_id, created_at);
create index if not exists orders_address_idx on orders (address_id);
create index if not exists orders_warehouse_idx on orders (warehouse_id);
create index if not exists orders_offer_idx on orders (offer_id) where offer_id is not null;
create index if not exists payments_order_idx on payments (order_id);
create index if not exists addresses_user_idx on addresses (user_id);
create index if not exists cart_items_variant_idx on cart_items (variant_id);
create index if not exists inventory_warehouse_idx on inventory (warehouse_id);
create index if not exists categories_parent_idx on categories (parent_id);
create index if not exists reviews_user_idx on reviews (user_id);
create index if not exists reviews_order_idx on reviews (order_id);
create index if not exists order_returns_user_idx on order_returns (user_id);
create index if not exists offer_redemptions_order_idx on offer_redemptions (order_id);
create index if not exists wishlist_items_product_idx on wishlist_items (product_id);
create index if not exists delivery_assignments_rider_idx on delivery_assignments (rider_id);
create index if not exists product_variants_master_variant_idx on product_variants (master_variant_id) where master_variant_id is not null;
create index if not exists stores_warehouse_idx on stores (warehouse_id);
create index if not exists profiles_tenant_idx on profiles (tenant_id);

create or replace function search_master_products(
  p_status text,
  p_q text default null,
  p_category uuid default null,
  p_limit int default 40,
  p_offset int default 0,
  p_offers boolean default false
) returns jsonb
language plpgsql
stable
as $$
declare
  v_q text := nullif(btrim(coalesce(p_q, '')), '');
  v_like text;
  v_prefix text;
  v_total int;
  v_ids uuid[];
  v_items jsonb;
begin
  if v_q is not null then
    v_like := '%' || replace(replace(v_q, '%', '\%'), '_', '\_') || '%';
    v_prefix := replace(replace(v_q, '%', '\%'), '_', '\_') || '%';
  end if;
  select count(*) into v_total
  from master_products m
  where m.status = p_status
    and (p_category is null or m.category_id = p_category or m.category_id in (select c.id from categories c where c.parent_id = p_category))
    and (v_q is null or m.name ilike v_like or m.brand ilike v_like or m.name_ar ilike v_like or m.barcode = v_q);
  -- Step 1: only the ids of the wanted page, in order. With nothing typed this is a walk down the name index, not a sort of everything.
  if v_q is null then
    select coalesce(array_agg(s.id order by s.name, s.id), '{}') into v_ids
    from (
      select m.id, m.name
      from master_products m
      where m.status = p_status
        and (p_category is null or m.category_id = p_category or m.category_id in (select c.id from categories c where c.parent_id = p_category))
      order by m.name, m.id
      limit greatest(p_limit, 1) offset greatest(p_offset, 0)
    ) s;
  else
    select coalesce(array_agg(s.id order by s.rk, s.name, s.id), '{}') into v_ids
    from (
      select m.id, m.name,
        case when lower(m.name) = lower(v_q) or m.barcode = v_q then 0 when m.name ilike v_prefix then 1 when m.brand ilike v_prefix then 2 else 3 end as rk
      from master_products m
      where m.status = p_status
        and (p_category is null or m.category_id = p_category or m.category_id in (select c.id from categories c where c.parent_id = p_category))
        and (m.name ilike v_like or m.brand ilike v_like or m.name_ar ilike v_like or m.barcode = v_q)
      order by 3, 2, 1
      limit greatest(p_limit, 1) offset greatest(p_offset, 0)
    ) s;
  end if;
  -- Step 2: the details, built only for those few products, kept in the same order.
  select coalesce(jsonb_agg(x.j order by x.ord), '[]'::jsonb) into v_items
  from (
    select
      array_position(v_ids, m.id) as ord,
      jsonb_build_object(
        'id', m.id, 'name', m.name, 'name_ar', m.name_ar, 'brand', m.brand, 'brand_ar', m.brand_ar,
        'description', m.description, 'description_ar', m.description_ar, 'category_id', m.category_id,
        'image_url', m.image_url, 'barcode', m.barcode, 'hsn_code', m.hsn_code, 'tax_rate', m.tax_rate,
        'status', m.status, 'requested_by_store', m.requested_by_store, 'rejection_reason', m.rejection_reason,
        'created_at', m.created_at,
        'categories', (select jsonb_build_object('name', c.name) from categories c where c.id = m.category_id),
        'stores', (select jsonb_build_object('name', s.name) from stores s where s.id = m.requested_by_store),
        'master_variants', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'label', v.label, 'label_ar', v.label_ar, 'unit', v.unit, 'quantity', v.quantity, 'barcode', v.barcode, 'is_default', v.is_default, 'sort_order', v.sort_order)) from master_variants v where v.master_id = m.id), '[]'::jsonb),
        'offers', case when p_offers then (select count(*) from products p where p.master_id = m.id) else 0 end
      ) as j
    from master_products m
    where m.id = any(v_ids)
  ) x;
  return jsonb_build_object('total', v_total, 'items', v_items);
end;
$$;

grant execute on function search_master_products(text, text, uuid, int, int, boolean) to authenticated;

-- The supplier's dashboard and orders-page numbers in one call (runs with the caller's rights, so a supplier only counts their own orders).
create or replace function merchant_stats(p_store uuid) returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'products', (select count(*) from products where store_id = p_store),
    'active', (select count(*) from products where store_id = p_store and is_active),
    'low_stock', (select count(*) from inventory i join product_variants v on v.id = i.variant_id join products p on p.id = v.product_id where p.store_id = p_store and i.stock < i.min_stock),
    'new_orders', (select count(*) from orders where status in ('pending', 'confirmed')),
    'preparing', (select count(*) from orders where status = 'preparing'),
    'ready', (select count(*) from orders where status = 'ready_for_pickup')
  );
$$;
grant execute on function merchant_stats(uuid) to authenticated;

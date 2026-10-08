-- Fast catalog search: indexes for partial matches and one function that returns a page of products, the total, pack sizes,
-- category and (optionally) the supplier count in a single round trip. It runs with the caller's rights, so the tenant fences
-- and row policies still apply exactly as before.
-- Run the whole file in the Supabase SQL editor. No blank lines inside function bodies.

create extension if not exists pg_trgm;
create index if not exists master_products_brand_trgm_idx on master_products using gin (brand gin_trgm_ops);
create index if not exists master_products_name_ar_trgm_idx on master_products using gin (name_ar gin_trgm_ops);
create index if not exists master_products_status_name_idx on master_products (tenant_id, status, name);
create index if not exists master_products_requested_idx on master_products (requested_by_store) where requested_by_store is not null;

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
  select coalesce(jsonb_agg(x.j order by x.rk, x.nm), '[]'::jsonb) into v_items
  from (
    select
      case when v_q is null then 0 when lower(m.name) = lower(v_q) or m.barcode = v_q then 0 when m.name ilike v_prefix then 1 when m.brand ilike v_prefix then 2 else 3 end as rk,
      m.name as nm,
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
    where m.status = p_status
      and (p_category is null or m.category_id = p_category or m.category_id in (select c.id from categories c where c.parent_id = p_category))
      and (v_q is null or m.name ilike v_like or m.brand ilike v_like or m.name_ar ilike v_like or m.barcode = v_q)
    order by 1, 2
    limit greatest(p_limit, 1) offset greatest(p_offset, 0)
  ) x;
  return jsonb_build_object('total', v_total, 'items', v_items);
end;
$$;

grant execute on function search_master_products(text, text, uuid, int, int, boolean) to authenticated;

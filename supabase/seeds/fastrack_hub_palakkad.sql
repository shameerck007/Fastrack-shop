-- FasTrack's own dark store for India: "FasTrack India Hub (Palakkad)" with 40 FasTrack-owned products
-- (fruits, vegetables, dairy, bread, staples) with photos, GST slabs, HSN codes and stock.
-- Delivery area: Express within 5 km, Standard within 50 km (1 day). Run ONCE in the Supabase SQL editor; safe to re-run.
-- Also run 0058_default_warehouse_per_market.sql once. Fill in FasTrack India's company details (name, address, state, GSTIN) in
-- Admin > Business settings: FasTrack is the seller on these orders. Set the exact location on the map in Admin > Delivery zones.
-- Assign warehouse staff to this location in Admin > FasTrack stores. No blank lines inside statements.
insert into categories (name, slug, icon, sort_order, tenant_id) values
  ('Fruits & Vegetables', 'in-fruits-vegetables', 'apple', 1, '00000000-0000-0000-0000-0000000000a2'),
  ('Rice, Spices & Staples', 'in-staples', 'shopping-basket', 2, '00000000-0000-0000-0000-0000000000a2'),
  ('Dairy & Eggs', 'in-dairy', 'milk', 4, '00000000-0000-0000-0000-0000000000a2'),
  ('Bakery', 'in-bakery', 'bread', 5, '00000000-0000-0000-0000-0000000000a2')
on conflict (slug) do nothing;
insert into warehouses (id, name, address_line, lat, lng, is_active, delivery_radius_km, standard_delivery_enabled, standard_delivery_days, standard_radius_km, tenant_id) values
  ('00000000-0000-0000-0000-0000000001c1', 'FasTrack India Hub (Palakkad)', 'Palakkad, Kerala 678001', 10.7700, 76.6400, true, 5, true, 1, 50, '00000000-0000-0000-0000-0000000000a2')
on conflict (id) do nothing;
create temp table _ft_seed (sku text, cat text, name text, brand text, descr text, fresh boolean, tax numeric, hsn text, label text, unit text, qty numeric, price numeric, mrp numeric, image text);
insert into _ft_seed values
  ('IN-FT-001', 'in-fruits-vegetables', 'Robusta Banana', 'FasTrack Fresh', 'Ripe, sweet table bananas.', true, 0, '0803', '1 kg', 'kg', 1, 52, null, '/seed/kerala/kl-s1-002.jpg'),
  ('IN-FT-002', 'in-fruits-vegetables', 'Nendran Banana', 'FasTrack Fresh', 'Kerala''s favourite cooking banana.', true, 0, '0803', '1 kg', 'kg', 1, 72, null, '/seed/kerala/kl-s1-001.jpg'),
  ('IN-FT-003', 'in-fruits-vegetables', 'Pineapple', 'FasTrack Fresh', 'Sweet pineapple.', true, 0, '0804', '1 pc', 'unit', 1, 58, 65, '/seed/kerala/kl-s1-003.jpg'),
  ('IN-FT-004', 'in-fruits-vegetables', 'Papaya', 'FasTrack Fresh', 'Ripe red papaya.', true, 0, '0807', '1 kg', 'kg', 1, 46, null, '/seed/kerala/kl-s1-004.jpg'),
  ('IN-FT-005', 'in-fruits-vegetables', 'Tender Coconut', 'FasTrack Fresh', 'Fresh tender coconut.', true, 0, '0801', '1 pc', 'unit', 1, 45, null, '/seed/kerala/kl-s1-005.jpg'),
  ('IN-FT-006', 'in-fruits-vegetables', 'Apple', 'FasTrack Fresh', 'Crisp red apples.', true, 0, '0808', '1 kg', 'kg', 1, 189, 209, '/seed/kerala/ft-apple.jpg'),
  ('IN-FT-007', 'in-fruits-vegetables', 'Orange', 'FasTrack Fresh', 'Juicy oranges.', true, 0, '0805', '1 kg', 'kg', 1, 99, null, '/seed/kerala/ft-orange.jpg'),
  ('IN-FT-008', 'in-fruits-vegetables', 'Pomegranate', 'FasTrack Fresh', 'Sweet red pomegranates.', true, 0, '0810', '500 g', 'g', 500, 89, null, '/seed/kerala/ft-pomegranate.jpg'),
  ('IN-FT-009', 'in-fruits-vegetables', 'Green Grapes', 'FasTrack Fresh', 'Seedless green grapes.', true, 0, '0806', '500 g', 'g', 500, 89, null, '/seed/kerala/ft-grapes.jpg'),
  ('IN-FT-010', 'in-fruits-vegetables', 'Watermelon', 'FasTrack Fresh', 'Sweet red watermelon.', true, 0, '0807', '1 kg', 'kg', 1, 38, null, '/seed/kerala/ft-watermelon.jpg'),
  ('IN-FT-011', 'in-fruits-vegetables', 'Onion', 'FasTrack Fresh', 'Fresh red onions.', true, 0, '0703', '1 kg', 'kg', 1, 44, null, '/seed/kerala/ft-onion.jpg'),
  ('IN-FT-012', 'in-fruits-vegetables', 'Sambar Onion (Small)', 'FasTrack Fresh', 'Small shallots for Kerala curries.', true, 0, '0703', '500 g', 'g', 500, 72, null, '/seed/kerala/kl-s1-011.jpg'),
  ('IN-FT-013', 'in-fruits-vegetables', 'Tomato', 'FasTrack Fresh', 'Fresh ripe tomatoes.', true, 0, '0702', '1 kg', 'kg', 1, 39, null, '/seed/kerala/ft-tomato.jpg'),
  ('IN-FT-014', 'in-fruits-vegetables', 'Potato', 'FasTrack Fresh', 'Fresh potatoes.', true, 0, '0701', '1 kg', 'kg', 1, 36, null, '/seed/kerala/ft-potato.jpg'),
  ('IN-FT-015', 'in-fruits-vegetables', 'Carrot', 'FasTrack Fresh', 'Sweet crunchy carrots.', true, 0, '0706', '1 kg', 'kg', 1, 52, null, '/seed/kerala/ft-carrot.jpg'),
  ('IN-FT-016', 'in-fruits-vegetables', 'Cucumber', 'FasTrack Fresh', 'Fresh green cucumber.', true, 0, '0707', '1 kg', 'kg', 1, 40, null, '/seed/kerala/ft-cucumber.jpg'),
  ('IN-FT-017', 'in-fruits-vegetables', 'Green Chilli', 'FasTrack Fresh', 'Fresh green chillies.', true, 0, '0709', '100 g', 'g', 100, 16, null, '/seed/kerala/ft-green-chilli.jpg'),
  ('IN-FT-018', 'in-fruits-vegetables', 'Ginger', 'FasTrack Fresh', 'Fresh ginger root.', true, 0, '0910', '250 g', 'g', 250, 48, null, '/seed/kerala/ft-ginger.jpg'),
  ('IN-FT-019', 'in-fruits-vegetables', 'Garlic', 'FasTrack Fresh', 'Fresh garlic bulbs.', true, 0, '0703', '250 g', 'g', 250, 58, null, '/seed/kerala/ft-garlic.jpg'),
  ('IN-FT-020', 'in-fruits-vegetables', 'Brinjal', 'FasTrack Fresh', 'Fresh purple brinjal.', true, 0, '0709', '500 g', 'g', 500, 44, null, '/seed/kerala/ft-brinjal.jpg'),
  ('IN-FT-021', 'in-fruits-vegetables', 'Okra (Ladies Finger)', 'FasTrack Fresh', 'Tender green okra.', true, 0, '0709', '500 g', 'g', 500, 48, null, '/seed/kerala/ft-okra.jpg'),
  ('IN-FT-022', 'in-dairy', 'Toned Milk', 'FasTrack Select', 'Pasteurised toned milk.', false, 0, '0401', '500 ml', 'ml', 500, 29, null, '/seed/kerala/kl-s4-001.jpg'),
  ('IN-FT-023', 'in-dairy', 'Fresh Curd', 'FasTrack Select', 'Set curd, made daily.', false, 0, '0403', '500 g', 'g', 500, 38, null, '/seed/kerala/kl-s4-002.jpg'),
  ('IN-FT-024', 'in-dairy', 'Paneer', 'FasTrack Select', 'Fresh cottage cheese.', false, 5, '0406', '200 g', 'g', 200, 98, null, '/seed/kerala/kl-s4-003.jpg'),
  ('IN-FT-025', 'in-dairy', 'Salted Butter', 'FasTrack Select', 'Creamy table butter.', false, 12, '0405', '100 g', 'g', 100, 62, null, '/seed/kerala/kl-s4-004.jpg'),
  ('IN-FT-026', 'in-dairy', 'Farm Eggs', 'FasTrack Select', 'Farm-fresh eggs.', true, 0, '0407', '12 pcs', 'unit', 12, 84, null, '/seed/kerala/kl-s4-006.jpg'),
  ('IN-FT-027', 'in-bakery', 'Sandwich Bread', 'FasTrack Select', 'Soft white sandwich bread.', false, 0, '1905', '400 g', 'g', 400, 45, null, '/seed/kerala/kl-s4-007.jpg'),
  ('IN-FT-028', 'in-bakery', 'Kerala Parotta', 'FasTrack Select', 'Layered parotta, pack of 5.', false, 18, '1905', '5 pcs', 'unit', 5, 60, null, '/seed/kerala/kl-s4-008.jpg'),
  ('IN-FT-029', 'in-bakery', 'Plum Cake', 'FasTrack Select', 'Rich fruit plum cake.', false, 18, '1905', '400 g', 'g', 400, 220, null, '/seed/kerala/kl-s4-009.jpg'),
  ('IN-FT-030', 'in-bakery', 'Tea Rusk', 'FasTrack Select', 'Crunchy rusk for tea time.', false, 18, '1905', '200 g', 'g', 200, 45, null, '/seed/kerala/kl-s4-010.jpg'),
  ('IN-FT-031', 'in-bakery', 'Burger Buns', 'FasTrack Select', 'Soft burger buns, pack of 4.', false, 0, '1905', '4 pcs', 'unit', 4, 40, null, '/seed/kerala/ft-buns.jpg'),
  ('IN-FT-032', 'in-staples', 'Palakkadan Matta Rice', 'FasTrack Select', 'Red parboiled matta rice.', false, 5, '1006', '5 kg', 'kg', 5, 385, 420, '/seed/kerala/kl-s6-001.jpg'),
  ('IN-FT-033', 'in-staples', 'Whole Wheat Atta', 'FasTrack Select', 'Stone-ground whole wheat flour.', false, 5, '1101', '5 kg', 'kg', 5, 265, 285, '/seed/kerala/kl-s6-009.jpg'),
  ('IN-FT-034', 'in-staples', 'Toor Dal', 'FasTrack Select', 'Unpolished toor dal.', false, 5, '0713', '1 kg', 'kg', 1, 165, 175, '/seed/kerala/kl-s6-014.jpg'),
  ('IN-FT-035', 'in-staples', 'Sugar', 'FasTrack Select', 'Fine grain sugar.', false, 5, '1701', '1 kg', 'kg', 1, 46, null, '/seed/kerala/kl-s6-023.jpg'),
  ('IN-FT-036', 'in-staples', 'Iodised Salt', 'FasTrack Select', 'Free-flow iodised salt.', false, 0, '2501', '1 kg', 'kg', 1, 24, null, '/seed/kerala/kl-s6-025.jpg'),
  ('IN-FT-037', 'in-staples', 'Coconut Oil', 'FasTrack Select', 'Pure Kerala coconut oil.', false, 5, '1513', '1 L', 'l', 1, 235, 255, '/seed/kerala/kl-s6-026.jpg'),
  ('IN-FT-038', 'in-staples', 'Sunflower Oil', 'FasTrack Select', 'Refined sunflower oil.', false, 5, '1512', '1 L', 'l', 1, 142, 155, '/seed/kerala/kl-s6-027.jpg'),
  ('IN-FT-039', 'in-staples', 'Tea Powder', 'FasTrack Select', 'Strong CTC tea.', false, 5, '0902', '500 g', 'g', 500, 235, null, '/seed/kerala/kl-s6-046.jpg'),
  ('IN-FT-040', 'in-staples', 'Turmeric Powder', 'FasTrack Select', 'Pure ground turmeric.', false, 5, '0910', '200 g', 'g', 200, 62, null, '/seed/kerala/kl-s2-008.jpg');
insert into products (store_id, category_id, sku, name, brand, description, is_fresh, tax_rate, hsn_code, image_url, tenant_id)
select null, c.id, k.sku, k.name, k.brand, k.descr, k.fresh, k.tax, k.hsn, k.image, '00000000-0000-0000-0000-0000000000a2'
from _ft_seed k join categories c on c.slug = k.cat
on conflict (sku) do nothing;
insert into product_variants (product_id, label, unit, quantity, price, compare_at_price, is_default, tenant_id)
select p.id, k.label, k.unit, k.qty, k.price, k.mrp, true, '00000000-0000-0000-0000-0000000000a2'
from _ft_seed k join products p on p.sku = k.sku
where not exists (select 1 from product_variants v where v.product_id = p.id);
insert into inventory (variant_id, warehouse_id, stock, min_stock, tenant_id)
select v.id, '00000000-0000-0000-0000-0000000001c1', 100, 20, '00000000-0000-0000-0000-0000000000a2'
from product_variants v join products p on p.id = v.product_id
where p.sku like 'IN-FT-%'
on conflict (variant_id, warehouse_id) do nothing;

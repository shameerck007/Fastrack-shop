-- India demo catalogue (FasTrack's own stock for the India market): 8 categories, 37 products with
-- real GST slabs + HSN codes, rupee prices (tax-inclusive MRP), and stock in a Mumbai FasTrack warehouse.
-- Run ONCE in the Supabase SQL editor when you are ready to stock India. Safe to re-run (it skips what exists).
-- Replace the demo products with the real range, or hide them, before the public launch.
-- No blank lines inside statements (the SQL editor splits on blank lines).
insert into warehouses (id, name, address_line, lat, lng, is_active, delivery_radius_km, standard_delivery_enabled, standard_delivery_days, tenant_id)
values ('00000000-0000-0000-0000-0000000001a2', 'FasTrack India Hub (Mumbai)', 'Andheri East, Mumbai, Maharashtra 400069', 19.1136, 72.8697, true, 8, true, 2, '00000000-0000-0000-0000-0000000000a2')
on conflict (id) do nothing;
insert into categories (name, slug, icon, sort_order, tenant_id) values
  ('Fresh Fruits', 'in-fruits', 'apple', 1, '00000000-0000-0000-0000-0000000000a2'),
  ('Vegetables', 'in-vegetables', 'carrot', 2, '00000000-0000-0000-0000-0000000000a2'),
  ('Grocery & Staples', 'in-grocery', 'shopping-basket', 3, '00000000-0000-0000-0000-0000000000a2'),
  ('Dairy & Eggs', 'in-dairy', 'milk', 4, '00000000-0000-0000-0000-0000000000a2'),
  ('Meat & Fish', 'in-meat', 'beef', 5, '00000000-0000-0000-0000-0000000000a2'),
  ('Bakery & Biscuits', 'in-bakery', 'bread', 6, '00000000-0000-0000-0000-0000000000a2'),
  ('Beverages', 'in-beverages', 'cup-soda', 7, '00000000-0000-0000-0000-0000000000a2'),
  ('Household', 'in-household', 'spray-can', 8, '00000000-0000-0000-0000-0000000000a2')
on conflict (slug) do nothing;
create temp table _in_seed (cat text, sku text, name text, brand text, descr text, fresh boolean, tax numeric, hsn text, label text, unit text, qty numeric, price numeric, mrp numeric);
insert into _in_seed values
  ('fruits', 'IN-FR-001', 'Banana (Robusta)', 'FasTrack Fresh', 'Ripe Robusta bananas, sold per dozen.', true, 0, '0803', '12 pcs', 'unit', 12, 59, null),
  ('fruits', 'IN-FR-002', 'Apple (Shimla)', 'FasTrack Fresh', 'Crisp Shimla apples.', true, 0, '0808', '1 kg', 'kg', 1, 179, 199),
  ('fruits', 'IN-FR-003', 'Pomegranate', 'FasTrack Fresh', 'Sweet red pomegranates.', true, 0, '0810', '500 g', 'g', 500, 89, null),
  ('fruits', 'IN-FR-004', 'Alphonso Mango', 'FasTrack Fresh', 'Seasonal Alphonso mangoes.', true, 0, '0804', '1 kg', 'kg', 1, 349, 399),
  ('vegetables', 'IN-VG-001', 'Onion', 'FasTrack Fresh', 'Fresh red onions.', true, 0, '0703', '1 kg', 'kg', 1, 42, null),
  ('vegetables', 'IN-VG-002', 'Tomato', 'FasTrack Fresh', 'Fresh country tomatoes.', true, 0, '0702', '1 kg', 'kg', 1, 38, null),
  ('vegetables', 'IN-VG-003', 'Potato', 'FasTrack Fresh', 'Fresh potatoes.', true, 0, '0701', '1 kg', 'kg', 1, 34, null),
  ('vegetables', 'IN-VG-004', 'Green Chilli', 'FasTrack Fresh', 'Fresh green chillies.', true, 0, '0709', '100 g', 'g', 100, 15, null),
  ('vegetables', 'IN-VG-005', 'Coriander Leaves', 'FasTrack Fresh', 'Fresh coriander bunch.', true, 0, '0709', '1 bunch', 'unit', 1, 12, null),
  ('grocery', 'IN-GR-001', 'Basmati Rice', 'India Gate', 'Long-grain basmati rice.', false, 5, '1006', '5 kg', 'kg', 5, 589, 649),
  ('grocery', 'IN-GR-002', 'Whole Wheat Atta', 'Aashirvaad', 'Whole wheat flour.', false, 0, '1101', '5 kg', 'kg', 5, 265, 285),
  ('grocery', 'IN-GR-003', 'Toor Dal', 'Tata Sampann', 'Unpolished toor dal.', false, 0, '0713', '1 kg', 'kg', 1, 168, 185),
  ('grocery', 'IN-GR-004', 'Sunflower Oil', 'Fortune', 'Refined sunflower oil.', false, 5, '1512', '1 L', 'l', 1, 142, 155),
  ('grocery', 'IN-GR-005', 'Sugar', 'FasTrack Select', 'Fine grain sugar.', false, 5, '1701', '1 kg', 'kg', 1, 48, null),
  ('grocery', 'IN-GR-006', 'Iodised Salt', 'Tata Salt', 'Vacuum-evaporated iodised salt.', false, 0, '2501', '1 kg', 'kg', 1, 28, null),
  ('grocery', 'IN-GR-007', 'Tea Leaves', 'Tata Tea Gold', 'Strong leaf tea.', false, 5, '0902', '500 g', 'g', 500, 265, 285),
  ('dairy', 'IN-DY-001', 'Full Cream Milk', 'Amul Gold', 'Pasteurised full cream milk.', false, 0, '0401', '1 L', 'l', 1, 72, null),
  ('dairy', 'IN-DY-002', 'Curd', 'Mother Dairy', 'Fresh set curd.', false, 0, '0403', '400 g', 'g', 400, 40, null),
  ('dairy', 'IN-DY-003', 'Paneer', 'Amul', 'Fresh cottage cheese.', false, 0, '0406', '200 g', 'g', 200, 95, null),
  ('dairy', 'IN-DY-004', 'Butter', 'Amul', 'Salted table butter.', false, 12, '0405', '100 g', 'g', 100, 62, null),
  ('dairy', 'IN-DY-005', 'Cow Ghee', 'Amul', 'Pure cow ghee.', false, 12, '0405', '500 ml', 'ml', 500, 335, 359),
  ('dairy', 'IN-DY-006', 'Eggs', 'FasTrack Select', 'Farm-fresh white eggs.', true, 0, '0407', '12 pcs', 'unit', 12, 84, null),
  ('meat', 'IN-MT-001', 'Chicken Curry Cut', 'FasTrack Fresh', 'Fresh chicken, skinless curry cut.', true, 0, '0207', '500 g', 'g', 500, 145, null),
  ('meat', 'IN-MT-002', 'Mutton Curry Cut', 'FasTrack Fresh', 'Fresh goat meat, curry cut.', true, 0, '0204', '500 g', 'g', 500, 425, null),
  ('meat', 'IN-MT-003', 'Rohu Fish', 'FasTrack Fresh', 'Cleaned rohu fish steaks.', true, 0, '0302', '500 g', 'g', 500, 185, null),
  ('bakery', 'IN-BK-001', 'Sandwich Bread', 'Britannia', 'Soft white sandwich bread.', false, 0, '1905', '400 g', 'g', 400, 45, null),
  ('bakery', 'IN-BK-002', 'Pav', 'Modern', 'Soft dinner pav, 6 pack.', false, 0, '1905', '6 pcs', 'unit', 6, 30, null),
  ('bakery', 'IN-BK-003', 'Digestive Biscuits', 'McVities', 'Whole wheat digestive biscuits.', false, 18, '1905', '250 g', 'g', 250, 60, 65),
  ('bakery', 'IN-BK-004', 'Cream Biscuits', 'Parle', 'Orange cream biscuits.', false, 18, '1905', '120 g', 'g', 120, 25, null),
  ('beverages', 'IN-BV-001', 'Cola', 'Coca-Cola', 'Carbonated soft drink.', false, 28, '2202', '750 ml', 'ml', 750, 40, null),
  ('beverages', 'IN-BV-002', 'Mango Juice', 'Real', 'Fruit drink, mango.', false, 12, '2202', '1 L', 'l', 1, 115, 125),
  ('beverages', 'IN-BV-003', 'Packaged Drinking Water', 'Bisleri', 'Packaged drinking water.', false, 18, '2201', '1 L', 'l', 1, 20, null),
  ('beverages', 'IN-BV-004', 'Instant Coffee', 'Nescafe', 'Classic instant coffee.', false, 5, '2101', '100 g', 'g', 100, 320, 345),
  ('household', 'IN-HH-001', 'Dishwash Liquid', 'Vim', 'Lemon dishwash liquid.', false, 18, '3402', '500 ml', 'ml', 500, 105, 115),
  ('household', 'IN-HH-002', 'Laundry Detergent', 'Surf Excel', 'Easy wash detergent powder.', false, 18, '3402', '1 kg', 'kg', 1, 135, 145),
  ('household', 'IN-HH-003', 'Bathing Soap', 'Dettol', 'Original bathing soap, pack of 3.', false, 18, '3401', '3 x 75 g', 'unit', 3, 125, 135),
  ('household', 'IN-HH-004', 'Toothpaste', 'Colgate', 'Strong teeth toothpaste.', false, 18, '3306', '200 g', 'g', 200, 115, 125);
insert into products (category_id, sku, name, brand, description, is_fresh, tax_rate, hsn_code, store_id, tenant_id)
select c.id, i.sku, i.name, i.brand, i.descr, i.fresh, i.tax, i.hsn, null, '00000000-0000-0000-0000-0000000000a2'
from _in_seed i join categories c on c.slug = 'in-' || i.cat
on conflict (sku) do nothing;
insert into product_variants (product_id, label, unit, quantity, price, compare_at_price, is_default, tenant_id)
select p.id, i.label, i.unit, i.qty, i.price, i.mrp, true, '00000000-0000-0000-0000-0000000000a2'
from _in_seed i join products p on p.sku = i.sku
where not exists (select 1 from product_variants v where v.product_id = p.id);
insert into inventory (variant_id, warehouse_id, stock, min_stock, tenant_id)
select v.id, '00000000-0000-0000-0000-0000000001a2', 100, 20, '00000000-0000-0000-0000-0000000000a2'
from product_variants v join products p on p.id = v.product_id
where p.sku like 'IN-%' and p.store_id is null
on conflict (variant_id, warehouse_id) do nothing;

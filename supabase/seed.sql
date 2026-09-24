-- Sample data for local development.

insert into warehouses (id, name, address_line, lat, lng) values
  ('00000000-0000-0000-0000-000000000001', 'FasTrack Warehouse — Azizia', 'Al Azizia, Riyadh', 24.6100, 46.7500);

insert into categories (id, name, name_ar, slug, icon, sort_order) values
  ('10000000-0000-0000-0000-000000000001', 'Fresh', 'طازج', 'fresh', 'leaf', 1),
  ('10000000-0000-0000-0000-000000000002', 'Fruits', 'فواكه', 'fruits', 'apple', 2),
  ('10000000-0000-0000-0000-000000000003', 'Vegetables', 'خضروات', 'vegetables', 'carrot', 3),
  ('10000000-0000-0000-0000-000000000004', 'Grocery', 'بقالة', 'grocery', 'shopping-basket', 4),
  ('10000000-0000-0000-0000-000000000005', 'Dairy', 'ألبان', 'dairy', 'milk', 5),
  ('10000000-0000-0000-0000-000000000006', 'Meat', 'لحوم', 'meat', 'beef', 6),
  ('10000000-0000-0000-0000-000000000007', 'Bakery', 'مخبوزات', 'bakery', 'bread', 7),
  ('10000000-0000-0000-0000-000000000008', 'Beverages', 'مشروبات', 'beverages', 'cup-soda', 8),
  ('10000000-0000-0000-0000-000000000009', 'Household', 'مستلزمات منزلية', 'household', 'spray-can', 9);

insert into products (id, category_id, sku, name, name_ar, brand, description, is_fresh, is_variable_weight, price_per_kg, image_url) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'FR-BAN-001', 'Nendran Banana', 'موز نندران', 'AgroFresh', 'Sweet, locally sourced Nendran bananas.', true, true, 7.50, null),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'VG-TOM-001', 'Tomato', 'طماطم', 'AgroFresh', 'Fresh red tomatoes.', true, true, 6.00, null),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000005', 'DY-MLK-001', 'Full Cream Milk', 'حليب كامل الدسم', 'Almarai', '1 litre carton.', false, false, null, null),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000006', 'MT-CHK-001', 'Whole Chicken', 'دجاج كامل', 'Al Watania', 'Fresh whole chicken, 1 kg avg.', true, true, 18.00, null);

insert into product_variants (id, product_id, label, unit, quantity, price, is_default) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '1 kg', 'kg', 1, 7.50, true),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '1 kg', 'kg', 1, 6.00, true),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', '1 litre', 'unit', 1, 12.00, true),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', '1 kg', 'kg', 1, 18.00, true);

insert into inventory (variant_id, warehouse_id, stock, min_stock) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 45, 15),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 60, 15),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 120, 30),
  ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 25, 10);

-- ============================================================
-- Extended demo catalog: ~36 more products across all 9 categories
-- (the block above only covers 4), including some with compare_at_price
-- (drives the home page's "Offers" section) and is_fresh = true (drives
-- "Fresh Today"). One item (Iceberg Lettuce) is deliberately below its
-- minimum stock to demo the admin low-stock indicator.
-- ============================================================

-- Fresh (herbs)
insert into products (id, category_id, sku, name, brand, description, is_fresh, is_variable_weight, image_url) values
  ('21000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'FR-MINT-001', 'Fresh Mint Bunch', 'Barakat', 'Aromatic fresh mint, perfect for tea and cooking.', true, false, null),
  ('21000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'FR-CORI-001', 'Coriander Bunch', 'Barakat', 'Fresh coriander leaves.', true, false, null),
  ('21000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'FR-LETT-001', 'Iceberg Lettuce', 'AgroFresh', 'Crisp iceberg lettuce head.', true, false, null),
  ('21000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'FR-CURR-001', 'Curry Leaves', 'Barakat', 'Fresh curry leaves bunch.', true, false, null);

insert into product_variants (id, product_id, label, unit, quantity, price, compare_at_price, is_default) values
  ('31000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', '1 bunch', 'unit', 1, 3.50, null, true),
  ('31000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000002', '1 bunch', 'unit', 1, 3.00, null, true),
  ('31000000-0000-0000-0000-000000000003', '21000000-0000-0000-0000-000000000003', '1 pc', 'unit', 1, 5.50, null, true),
  ('31000000-0000-0000-0000-000000000004', '21000000-0000-0000-0000-000000000004', '1 bunch', 'unit', 1, 2.50, null, true);

-- Fruits (Nendran Banana already seeded above)
insert into products (id, category_id, sku, name, brand, description, is_fresh, is_variable_weight, price_per_kg, image_url) values
  ('21000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'FR-APPL-001', 'Royal Gala Apple', 'AgroFresh', 'Sweet and crisp Royal Gala apples.', true, true, 12.00, null),
  ('21000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', 'FR-GRAP-001', 'Seedless Grapes', 'AgroFresh', 'Juicy seedless green grapes.', true, true, 15.00, null),
  ('21000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000002', 'FR-WATM-001', 'Watermelon', 'AgroFresh', 'Whole seasonal watermelon.', true, false, null, null),
  ('21000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000002', 'FR-ORAN-001', 'Orange', 'AgroFresh', 'Juicy fresh oranges.', true, true, 8.00, null);

insert into product_variants (id, product_id, label, unit, quantity, price, compare_at_price, is_default) values
  ('31000000-0000-0000-0000-000000000005', '21000000-0000-0000-0000-000000000005', '1 kg', 'kg', 1, 12.00, null, true),
  ('31000000-0000-0000-0000-000000000006', '21000000-0000-0000-0000-000000000006', '1 kg', 'kg', 1, 15.00, 18.00, true),
  ('31000000-0000-0000-0000-000000000007', '21000000-0000-0000-0000-000000000007', '1 pc (approx 5 kg)', 'unit', 1, 15.00, null, true),
  ('31000000-0000-0000-0000-000000000008', '21000000-0000-0000-0000-000000000008', '1 kg', 'kg', 1, 8.00, null, true);

-- Vegetables (Tomato already seeded above)
insert into products (id, category_id, sku, name, brand, description, is_fresh, is_variable_weight, price_per_kg, image_url) values
  ('21000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000003', 'VG-POT-001', 'Potato', 'AgroFresh', 'All-purpose potatoes.', true, true, 4.00, null),
  ('21000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000003', 'VG-ONI-001', 'Onion', 'AgroFresh', 'Fresh red onions.', true, true, 3.50, null),
  ('21000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000003', 'VG-CUC-001', 'Cucumber', 'AgroFresh', 'Crisp fresh cucumbers.', true, true, 5.00, null),
  ('21000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000003', 'VG-CAR-001', 'Carrot', 'AgroFresh', 'Sweet fresh carrots.', true, true, 4.50, null);

insert into product_variants (id, product_id, label, unit, quantity, price, compare_at_price, is_default) values
  ('31000000-0000-0000-0000-000000000009', '21000000-0000-0000-0000-000000000009', '1 kg', 'kg', 1, 4.00, null, true),
  ('31000000-0000-0000-0000-000000000010', '21000000-0000-0000-0000-000000000010', '1 kg', 'kg', 1, 3.50, null, true),
  ('31000000-0000-0000-0000-000000000011', '21000000-0000-0000-0000-000000000011', '1 kg', 'kg', 1, 5.00, null, true),
  ('31000000-0000-0000-0000-000000000012', '21000000-0000-0000-0000-000000000012', '1 kg', 'kg', 1, 4.50, 5.50, true);

-- Grocery
insert into products (id, category_id, sku, name, brand, description, is_fresh, is_variable_weight, image_url) values
  ('21000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000004', 'GR-RICE-001', 'Basmati Rice 5kg', 'Al Osra', 'Premium long-grain basmati rice.', false, false, null),
  ('21000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000004', 'GR-SUG-001', 'White Sugar 1kg', 'Al Osra', 'Refined white sugar.', false, false, null),
  ('21000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000004', 'GR-FLR-001', 'All Purpose Flour 1kg', 'Al Osra', 'Fine all-purpose wheat flour.', false, false, null),
  ('21000000-0000-0000-0000-000000000016', '10000000-0000-0000-0000-000000000004', 'GR-LEN-001', 'Red Lentils 1kg', 'Al Osra', 'Split red lentils.', false, false, null),
  ('21000000-0000-0000-0000-000000000017', '10000000-0000-0000-0000-000000000004', 'GR-OIL-001', 'Sunflower Cooking Oil 1.5L', 'Afia', 'Pure sunflower cooking oil.', false, false, null);

insert into product_variants (id, product_id, label, unit, quantity, price, compare_at_price, is_default) values
  ('31000000-0000-0000-0000-000000000013', '21000000-0000-0000-0000-000000000013', '5 kg bag', 'unit', 1, 45.00, 52.00, true),
  ('31000000-0000-0000-0000-000000000014', '21000000-0000-0000-0000-000000000014', '1 kg', 'unit', 1, 4.50, null, true),
  ('31000000-0000-0000-0000-000000000015', '21000000-0000-0000-0000-000000000015', '1 kg', 'unit', 1, 3.75, null, true),
  ('31000000-0000-0000-0000-000000000016', '21000000-0000-0000-0000-000000000016', '1 kg', 'unit', 1, 6.00, null, true),
  ('31000000-0000-0000-0000-000000000017', '21000000-0000-0000-0000-000000000017', '1.5 L', 'unit', 1, 18.00, null, true);

-- Dairy (Full Cream Milk already seeded above)
insert into products (id, category_id, sku, name, brand, description, is_fresh, is_variable_weight, image_url) values
  ('21000000-0000-0000-0000-000000000018', '10000000-0000-0000-0000-000000000005', 'DY-YOG-001', 'Greek Yogurt 500g', 'Almarai', 'Thick and creamy Greek yogurt.', false, false, null),
  ('21000000-0000-0000-0000-000000000019', '10000000-0000-0000-0000-000000000005', 'DY-CHE-001', 'Cheddar Cheese Block 200g', 'Almarai', 'Mature cheddar cheese block.', false, false, null),
  ('21000000-0000-0000-0000-000000000020', '10000000-0000-0000-0000-000000000005', 'DY-LAB-001', 'Labneh 400g', 'Nadec', 'Traditional strained yogurt.', false, false, null),
  ('21000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000005', 'DY-BUT-001', 'Salted Butter 200g', 'Almarai', 'Creamy salted butter.', false, false, null);

insert into product_variants (id, product_id, label, unit, quantity, price, compare_at_price, is_default) values
  ('31000000-0000-0000-0000-000000000018', '21000000-0000-0000-0000-000000000018', '500 g', 'unit', 1, 9.50, null, true),
  ('31000000-0000-0000-0000-000000000019', '21000000-0000-0000-0000-000000000019', '200 g', 'unit', 1, 14.00, null, true),
  ('31000000-0000-0000-0000-000000000020', '21000000-0000-0000-0000-000000000020', '400 g', 'unit', 1, 8.00, null, true),
  ('31000000-0000-0000-0000-000000000021', '21000000-0000-0000-0000-000000000021', '200 g', 'unit', 1, 11.00, 13.00, true);

-- Meat (Whole Chicken already seeded above)
insert into products (id, category_id, sku, name, brand, description, is_fresh, is_variable_weight, price_per_kg, image_url) values
  ('21000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000006', 'MT-BRST-001', 'Chicken Breast Fillet', 'Al Watania', 'Boneless, skinless chicken breast.', true, true, 24.00, null),
  ('21000000-0000-0000-0000-000000000023', '10000000-0000-0000-0000-000000000006', 'MT-LAMB-001', 'Lamb Chops', 'Al Watania', 'Fresh lamb chops.', true, true, 55.00, null),
  ('21000000-0000-0000-0000-000000000024', '10000000-0000-0000-0000-000000000006', 'MT-MINC-001', 'Minced Beef', 'Al Watania', 'Fresh lean minced beef.', true, true, 32.00, null);

insert into product_variants (id, product_id, label, unit, quantity, price, compare_at_price, is_default) values
  ('31000000-0000-0000-0000-000000000022', '21000000-0000-0000-0000-000000000022', '1 kg', 'kg', 1, 24.00, null, true),
  ('31000000-0000-0000-0000-000000000023', '21000000-0000-0000-0000-000000000023', '1 kg', 'kg', 1, 55.00, null, true),
  ('31000000-0000-0000-0000-000000000024', '21000000-0000-0000-0000-000000000024', '1 kg', 'kg', 1, 32.00, null, true);

-- Bakery
insert into products (id, category_id, sku, name, brand, description, is_fresh, is_variable_weight, image_url) values
  ('21000000-0000-0000-0000-000000000025', '10000000-0000-0000-0000-000000000007', 'BK-KHUB-001', 'Arabic Bread (Khubz) 5-pack', 'Bakery Fresh', 'Traditional Arabic flatbread.', true, false, null),
  ('21000000-0000-0000-0000-000000000026', '10000000-0000-0000-0000-000000000007', 'BK-SAND-001', 'White Sandwich Bread', 'Bakery Fresh', 'Soft white sandwich loaf.', false, false, null),
  ('21000000-0000-0000-0000-000000000027', '10000000-0000-0000-0000-000000000007', 'BK-CROI-001', 'Butter Croissant 4-pack', 'Bakery Fresh', 'Flaky butter croissants.', true, false, null),
  ('21000000-0000-0000-0000-000000000028', '10000000-0000-0000-0000-000000000007', 'BK-CAKE-001', 'Chocolate Cake Slice', 'Bakery Fresh', 'Rich chocolate cake slice.', true, false, null);

insert into product_variants (id, product_id, label, unit, quantity, price, compare_at_price, is_default) values
  ('31000000-0000-0000-0000-000000000025', '21000000-0000-0000-0000-000000000025', '5-pack', 'unit', 1, 3.00, null, true),
  ('31000000-0000-0000-0000-000000000026', '21000000-0000-0000-0000-000000000026', '1 loaf', 'unit', 1, 6.50, null, true),
  ('31000000-0000-0000-0000-000000000027', '21000000-0000-0000-0000-000000000027', '4-pack', 'unit', 1, 12.00, null, true),
  ('31000000-0000-0000-0000-000000000028', '21000000-0000-0000-0000-000000000028', '1 pc', 'unit', 1, 9.00, null, true);

-- Beverages
insert into products (id, category_id, sku, name, brand, description, is_fresh, is_variable_weight, image_url) values
  ('21000000-0000-0000-0000-000000000029', '10000000-0000-0000-0000-000000000008', 'BV-OJ-001', 'Fresh Orange Juice 1L', 'Rani', 'Freshly squeezed orange juice.', true, false, null),
  ('21000000-0000-0000-0000-000000000030', '10000000-0000-0000-0000-000000000008', 'BV-SPKL-001', 'Sparkling Water 750ml', 'Perrier', 'Naturally sparkling mineral water.', false, false, null),
  ('21000000-0000-0000-0000-000000000031', '10000000-0000-0000-0000-000000000008', 'BV-COFF-001', 'Arabic Coffee (Qahwa) 250g', 'Al Khair', 'Traditional Arabic coffee blend.', false, false, null),
  ('21000000-0000-0000-0000-000000000032', '10000000-0000-0000-0000-000000000008', 'BV-COLA-001', 'Cola 6-Pack (330ml)', 'Pepsi', 'Cola soft drink, 6-can pack.', false, false, null);

insert into product_variants (id, product_id, label, unit, quantity, price, compare_at_price, is_default) values
  ('31000000-0000-0000-0000-000000000029', '21000000-0000-0000-0000-000000000029', '1 L', 'unit', 1, 9.00, null, true),
  ('31000000-0000-0000-0000-000000000030', '21000000-0000-0000-0000-000000000030', '750 ml', 'unit', 1, 7.50, null, true),
  ('31000000-0000-0000-0000-000000000031', '21000000-0000-0000-0000-000000000031', '250 g', 'unit', 1, 22.00, null, true),
  ('31000000-0000-0000-0000-000000000032', '21000000-0000-0000-0000-000000000032', '6 x 330 ml', 'unit', 1, 15.00, 18.00, true);

-- Household
insert into products (id, category_id, sku, name, brand, description, is_fresh, is_variable_weight, image_url) values
  ('21000000-0000-0000-0000-000000000033', '10000000-0000-0000-0000-000000000009', 'HH-DISH-001', 'Dish Soap 750ml', 'Fairy', 'Effective grease-cutting dish soap.', false, false, null),
  ('21000000-0000-0000-0000-000000000034', '10000000-0000-0000-0000-000000000009', 'HH-LAUN-001', 'Laundry Detergent 3kg', 'Tide', 'Powder laundry detergent.', false, false, null),
  ('21000000-0000-0000-0000-000000000035', '10000000-0000-0000-0000-000000000009', 'HH-TISS-001', 'Tissue Box (200 sheets)', 'Fine', 'Soft facial tissues.', false, false, null),
  ('21000000-0000-0000-0000-000000000036', '10000000-0000-0000-0000-000000000009', 'HH-TRSH-001', 'Trash Bags 30-pack', 'Al Osra', 'Heavy-duty trash bags.', false, false, null);

insert into product_variants (id, product_id, label, unit, quantity, price, compare_at_price, is_default) values
  ('31000000-0000-0000-0000-000000000033', '21000000-0000-0000-0000-000000000033', '750 ml', 'unit', 1, 8.50, null, true),
  ('31000000-0000-0000-0000-000000000034', '21000000-0000-0000-0000-000000000034', '3 kg', 'unit', 1, 42.00, 48.00, true),
  ('31000000-0000-0000-0000-000000000035', '21000000-0000-0000-0000-000000000035', '200 sheets', 'unit', 1, 6.00, null, true),
  ('31000000-0000-0000-0000-000000000036', '21000000-0000-0000-0000-000000000036', '30-pack', 'unit', 1, 9.50, null, true);

insert into inventory (variant_id, warehouse_id, stock, min_stock) values
  ('31000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 30, 10),
  ('31000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 28, 10),
  ('31000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 4, 15),
  ('31000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 20, 8),
  ('31000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 70, 20),
  ('31000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 55, 15),
  ('31000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 25, 8),
  ('31000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 80, 20),
  ('31000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 100, 25),
  ('31000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 90, 25),
  ('31000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 65, 20),
  ('31000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 75, 20),
  ('31000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 40, 10),
  ('31000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', 120, 30),
  ('31000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001', 110, 30),
  ('31000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000001', 95, 25),
  ('31000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000001', 60, 15),
  ('31000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000001', 50, 15),
  ('31000000-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000001', 45, 15),
  ('31000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001', 55, 15),
  ('31000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', 48, 15),
  ('31000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000001', 35, 12),
  ('31000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000001', 20, 8),
  ('31000000-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000001', 30, 10),
  ('31000000-0000-0000-0000-000000000025', '00000000-0000-0000-0000-000000000001', 80, 20),
  ('31000000-0000-0000-0000-000000000026', '00000000-0000-0000-0000-000000000001', 40, 12),
  ('31000000-0000-0000-0000-000000000027', '00000000-0000-0000-0000-000000000001', 35, 10),
  ('31000000-0000-0000-0000-000000000028', '00000000-0000-0000-0000-000000000001', 25, 8),
  ('31000000-0000-0000-0000-000000000029', '00000000-0000-0000-0000-000000000001', 45, 12),
  ('31000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000001', 70, 20),
  ('31000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000001', 30, 10),
  ('31000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000001', 60, 15),
  ('31000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000001', 50, 15),
  ('31000000-0000-0000-0000-000000000034', '00000000-0000-0000-0000-000000000001', 35, 10),
  ('31000000-0000-0000-0000-000000000035', '00000000-0000-0000-0000-000000000001', 90, 25),
  ('31000000-0000-0000-0000-000000000036', '00000000-0000-0000-0000-000000000001', 65, 20);

-- ============================================================
-- Product photos, sourced from Wikimedia Commons (public domain / CC).
-- Special:FilePath redirects to the actual file regardless of its storage
-- path, so these links are stable without needing to know upload hashes.
-- Two products (Cheddar Cheese, Lamb Chops) have no verified real photo and
-- keep the gradient/emoji fallback from src/lib/categoryTheme.ts instead.
-- ============================================================

update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Bananas.jpg?width=400' where id = '20000000-0000-0000-0000-000000000001';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Tomato_je.jpg?width=400' where id = '20000000-0000-0000-0000-000000000002';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Milk_glass.jpg?width=400' where id = '20000000-0000-0000-0000-000000000003';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Chicken_meat.jpg?width=400' where id = '20000000-0000-0000-0000-000000000004';

update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Mint_leaves.jpg?width=400' where id = '21000000-0000-0000-0000-000000000001';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Coriander_leaves.jpg?width=400' where id = '21000000-0000-0000-0000-000000000002';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Iceberg_lettuce.jpg?width=400' where id = '21000000-0000-0000-0000-000000000003';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Curry_leaves.jpg?width=400' where id = '21000000-0000-0000-0000-000000000004';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Red_Apple.jpg?width=400' where id = '21000000-0000-0000-0000-000000000005';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Green_grapes.jpg?width=400' where id = '21000000-0000-0000-0000-000000000006';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Watermelon.jpg?width=400' where id = '21000000-0000-0000-0000-000000000007';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Orange-Fruit-Pieces.jpg?width=400' where id = '21000000-0000-0000-0000-000000000008';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Patates.jpg?width=400' where id = '21000000-0000-0000-0000-000000000009';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Onions.jpg?width=400' where id = '21000000-0000-0000-0000-000000000010';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Cucumbers.jpg?width=400' where id = '21000000-0000-0000-0000-000000000011';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Carrots.jpg?width=400' where id = '21000000-0000-0000-0000-000000000012';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Rice_p1160004.jpg?width=400' where id = '21000000-0000-0000-0000-000000000013';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Sugar_2xmacro.jpg?width=400' where id = '21000000-0000-0000-0000-000000000014';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Wheat_flour.jpg?width=400' where id = '21000000-0000-0000-0000-000000000015';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Masoor%20dal.JPG?width=400' where id = '21000000-0000-0000-0000-000000000016';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Sunflower_oil.jpg?width=400' where id = '21000000-0000-0000-0000-000000000017';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Food%20Portions%20%28Team%20Nutrition%29%20%2820210902-FNS-UNC-0054%29.jpg?width=400' where id = '21000000-0000-0000-0000-000000000018';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Labneh%20%285196911587%29.jpg?width=400' where id = '21000000-0000-0000-0000-000000000020';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Beurre.jpg?width=400' where id = '21000000-0000-0000-0000-000000000021';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Minced_meat.jpg?width=400' where id = '21000000-0000-0000-0000-000000000024';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Khubz.jpg?width=400' where id = '21000000-0000-0000-0000-000000000025';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/White_bread.jpg?width=400' where id = '21000000-0000-0000-0000-000000000026';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Croissants.jpg?width=400' where id = '21000000-0000-0000-0000-000000000027';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Chocolate_cake.jpg?width=400' where id = '21000000-0000-0000-0000-000000000028';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Orange_juice_2.jpg?width=400' where id = '21000000-0000-0000-0000-000000000029';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Sparkling_water.jpg?width=400' where id = '21000000-0000-0000-0000-000000000030';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Arabic_coffee.jpg?width=400' where id = '21000000-0000-0000-0000-000000000031';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Cola.jpg?width=400' where id = '21000000-0000-0000-0000-000000000032';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Tesco%20and%20Sainsburys%20own%20dishwashing%20liquid.jpg?width=400' where id = '21000000-0000-0000-0000-000000000033';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Laundry_detergents.jpg?width=400' where id = '21000000-0000-0000-0000-000000000034';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Tissue_box.jpg?width=400' where id = '21000000-0000-0000-0000-000000000035';
update products set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/A_typical_black_bin_bag_from_the_UK_20060811.jpg?width=400' where id = '21000000-0000-0000-0000-000000000036';

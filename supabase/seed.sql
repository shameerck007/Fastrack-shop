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

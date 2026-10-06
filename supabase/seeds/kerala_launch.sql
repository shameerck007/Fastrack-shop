-- Kerala launch data for the India market: 5 approved demo stores (Kozhikode, Kochi, Thiruvananthapuram,
-- Thrissur, Kannur) with logos, covers, 53 products with pictures, GST slabs, HSN codes, stock and a delivery area.
-- Run ONCE in the Supabase SQL editor. Safe to re-run (everything is keyed by fixed ids / skus).
-- These are DEMO stores so the shop has a full range at launch. Each owner login is a plus-address of your own email
-- (shameerck007+kl-store1@gmail.com ... store5): use "Sign in with a code" to open any store's dashboard. Before real
-- suppliers take over, edit the store in Admin > Merchants: real PAN / GSTIN / FSSAI, bank details, phone, pickup address.
-- Pictures are illustrations served from /seed/kerala/ in the app; suppliers replace them with real photos.
-- No blank lines inside statements (the SQL editor splits on blank lines).
insert into categories (name, slug, icon, sort_order, tenant_id) values
  ('Fruits & Vegetables', 'in-fruits-vegetables', 'apple', 1, '00000000-0000-0000-0000-0000000000a2'),
  ('Rice, Spices & Staples', 'in-staples', 'shopping-basket', 2, '00000000-0000-0000-0000-0000000000a2'),
  ('Fish & Meat', 'in-fish-meat', 'beef', 3, '00000000-0000-0000-0000-0000000000a2'),
  ('Dairy & Eggs', 'in-dairy', 'milk', 4, '00000000-0000-0000-0000-0000000000a2'),
  ('Bakery', 'in-bakery', 'bread', 5, '00000000-0000-0000-0000-0000000000a2'),
  ('Snacks & Sweets', 'in-snacks', 'cookie', 6, '00000000-0000-0000-0000-0000000000a2'),
  ('Beverages', 'in-beverages', 'cup-soda', 7, '00000000-0000-0000-0000-0000000000a2'),
  ('Household & Care', 'in-household', 'spray-can', 8, '00000000-0000-0000-0000-0000000000a2')
on conflict (slug) do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
select '00000000-0000-0000-0000-000000000000', o.id::uuid, 'authenticated', 'authenticated', o.email, crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', o.full_name, 'tenant_id', '00000000-0000-0000-0000-0000000000a2'), now(), now(), '', '', '', ''
from (values
  ('b2000000-0000-0000-0000-000000000001', 'shameerck007+kl-store1@gmail.com', 'Malabar Fresh Mart (owner)'),
  ('b2000000-0000-0000-0000-000000000002', 'shameerck007+kl-store2@gmail.com', 'Kochi Spice & Grocery (owner)'),
  ('b2000000-0000-0000-0000-000000000003', 'shameerck007+kl-store3@gmail.com', 'Anjengo Fish & Meat (owner)'),
  ('b2000000-0000-0000-0000-000000000004', 'shameerck007+kl-store4@gmail.com', 'Thrissur Dairy & Bakery (owner)'),
  ('b2000000-0000-0000-0000-000000000005', 'shameerck007+kl-store5@gmail.com', 'Kannur Super Bazaar (owner)')
) as o(id, email, full_name)
where not exists (select 1 from auth.users u where u.id = o.id::uuid);
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
from auth.users u
where u.email like 'shameerck007+kl-store_@gmail.com'
and not exists (select 1 from auth.identities i where i.user_id = u.id);
insert into profiles (id, full_name, tenant_id)
select u.id, u.raw_user_meta_data ->> 'full_name', '00000000-0000-0000-0000-0000000000a2'
from auth.users u
where u.email like 'shameerck007+kl-store_@gmail.com'
on conflict (id) do nothing;
update profiles set role = 'merchant', tenant_id = '00000000-0000-0000-0000-0000000000a2' where id in (select id from auth.users where email like 'shameerck007+kl-store_@gmail.com');
insert into warehouses (id, name, address_line, lat, lng, is_active, delivery_radius_km, standard_delivery_enabled, standard_delivery_days, standard_radius_km, tenant_id) values
  ('b3000000-0000-0000-0000-000000000001', 'Malabar Fresh Mart (Merchant)', 'Mavoor Road, Kozhikode, Kerala 673004', 11.2588, 75.7804, true, 12, true, 1, 100, '00000000-0000-0000-0000-0000000000a2'),
  ('b3000000-0000-0000-0000-000000000002', 'Kochi Spice & Grocery (Merchant)', 'Broadway, Ernakulam, Kochi, Kerala 682031', 9.9312, 76.2673, true, 12, true, 1, 100, '00000000-0000-0000-0000-0000000000a2'),
  ('b3000000-0000-0000-0000-000000000003', 'Anjengo Fish & Meat (Merchant)', 'Pettah, Thiruvananthapuram, Kerala 695024', 8.5241, 76.9366, true, 12, true, 1, 100, '00000000-0000-0000-0000-0000000000a2'),
  ('b3000000-0000-0000-0000-000000000004', 'Thrissur Dairy & Bakery (Merchant)', 'Round South, Thrissur, Kerala 680001', 10.5276, 76.2144, true, 12, true, 1, 100, '00000000-0000-0000-0000-0000000000a2'),
  ('b3000000-0000-0000-0000-000000000005', 'Kannur Super Bazaar (Merchant)', 'Fort Road, Kannur, Kerala 670001', 11.8745, 75.3704, true, 12, true, 1, 100, '00000000-0000-0000-0000-0000000000a2')
on conflict (id) do nothing;
insert into stores (id, owner_id, name, cr_number, city, state, country, status, warehouse_id, address_line, tagline, logo_url, cover_url, tenant_id) values
  ('b1000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', 'Malabar Fresh Mart', 'PENDING-PAN', 'Kozhikode', 'Kerala', 'India', 'approved', 'b3000000-0000-0000-0000-000000000001', 'Mavoor Road, Kozhikode, Kerala 673004', 'Farm-fresh fruits and vegetables from Malabar', '/seed/kerala/s1-logo.svg', '/seed/kerala/s1-cover.svg', '00000000-0000-0000-0000-0000000000a2'),
  ('b1000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000002', 'Kochi Spice & Grocery', 'PENDING-PAN', 'Kochi', 'Kerala', 'India', 'approved', 'b3000000-0000-0000-0000-000000000002', 'Broadway, Ernakulam, Kochi, Kerala 682031', 'Rice, spices and everyday kitchen staples', '/seed/kerala/s2-logo.svg', '/seed/kerala/s2-cover.svg', '00000000-0000-0000-0000-0000000000a2'),
  ('b1000000-0000-0000-0000-000000000003', 'b2000000-0000-0000-0000-000000000003', 'Anjengo Fish & Meat', 'PENDING-PAN', 'Thiruvananthapuram', 'Kerala', 'India', 'approved', 'b3000000-0000-0000-0000-000000000003', 'Pettah, Thiruvananthapuram, Kerala 695024', 'Fresh catch and cleaned meat, cut to order', '/seed/kerala/s3-logo.svg', '/seed/kerala/s3-cover.svg', '00000000-0000-0000-0000-0000000000a2'),
  ('b1000000-0000-0000-0000-000000000004', 'b2000000-0000-0000-0000-000000000004', 'Thrissur Dairy & Bakery', 'PENDING-PAN', 'Thrissur', 'Kerala', 'India', 'approved', 'b3000000-0000-0000-0000-000000000004', 'Round South, Thrissur, Kerala 680001', 'Milk, curd, eggs and fresh-baked breads', '/seed/kerala/s4-logo.svg', '/seed/kerala/s4-cover.svg', '00000000-0000-0000-0000-0000000000a2'),
  ('b1000000-0000-0000-0000-000000000005', 'b2000000-0000-0000-0000-000000000005', 'Kannur Super Bazaar', 'PENDING-PAN', 'Kannur', 'Kerala', 'India', 'approved', 'b3000000-0000-0000-0000-000000000005', 'Fort Road, Kannur, Kerala 670001', 'Snacks, drinks and home essentials', '/seed/kerala/s5-logo.svg', '/seed/kerala/s5-cover.svg', '00000000-0000-0000-0000-0000000000a2')
on conflict (id) do nothing;
create temp table _kl_seed (store_id uuid, cat text, sku text, name text, brand text, descr text, fresh boolean, tax numeric, hsn text, label text, unit text, qty numeric, price numeric, mrp numeric, image text);
insert into _kl_seed values
  ('b1000000-0000-0000-0000-000000000001', 'in-fruits-vegetables', 'KL-S1-001', 'Nendran Banana', 'Malabar Farms', 'Kerala''s favourite cooking banana.', true, 0, '0803', '1 kg', 'kg', 1, 68, null, '/seed/kerala/kl-s1-001.svg'),
  ('b1000000-0000-0000-0000-000000000001', 'in-fruits-vegetables', 'KL-S1-002', 'Robusta Banana', 'Malabar Farms', 'Ripe, sweet table bananas.', true, 0, '0803', '1 kg', 'kg', 1, 48, null, '/seed/kerala/kl-s1-002.svg'),
  ('b1000000-0000-0000-0000-000000000001', 'in-fruits-vegetables', 'KL-S1-003', 'Pineapple', 'Malabar Farms', 'Sweet Mauritius pineapple.', true, 0, '0804', '1 pc', 'unit', 1, 55, 65, '/seed/kerala/kl-s1-003.svg'),
  ('b1000000-0000-0000-0000-000000000001', 'in-fruits-vegetables', 'KL-S1-004', 'Papaya', 'Malabar Farms', 'Ripe red papaya.', true, 0, '0807', '1 kg', 'kg', 1, 45, null, '/seed/kerala/kl-s1-004.svg'),
  ('b1000000-0000-0000-0000-000000000001', 'in-fruits-vegetables', 'KL-S1-005', 'Tender Coconut', 'Malabar Farms', 'Fresh tender coconut (karikku).', true, 0, '0801', '1 pc', 'unit', 1, 45, null, '/seed/kerala/kl-s1-005.svg'),
  ('b1000000-0000-0000-0000-000000000001', 'in-fruits-vegetables', 'KL-S1-006', 'Drumstick', 'Malabar Farms', 'Fresh drumstick for sambar.', true, 0, '0709', '250 g', 'g', 250, 30, null, '/seed/kerala/kl-s1-006.svg'),
  ('b1000000-0000-0000-0000-000000000001', 'in-fruits-vegetables', 'KL-S1-007', 'Raw Banana', 'Malabar Farms', 'Raw plantain for thoran and chips.', true, 0, '0803', '500 g', 'g', 500, 32, null, '/seed/kerala/kl-s1-007.svg'),
  ('b1000000-0000-0000-0000-000000000001', 'in-fruits-vegetables', 'KL-S1-008', 'Ash Gourd', 'Malabar Farms', 'Fresh ash gourd (kumbalanga).', true, 0, '0709', '1 kg', 'kg', 1, 35, null, '/seed/kerala/kl-s1-008.svg'),
  ('b1000000-0000-0000-0000-000000000001', 'in-fruits-vegetables', 'KL-S1-009', 'Curry Leaves', 'Malabar Farms', 'Fresh curry leaves.', true, 0, '0709', '100 g', 'g', 100, 12, null, '/seed/kerala/kl-s1-009.svg'),
  ('b1000000-0000-0000-0000-000000000001', 'in-fruits-vegetables', 'KL-S1-010', 'Tapioca (Kappa)', 'Malabar Farms', 'Fresh tapioca roots.', true, 0, '0714', '1 kg', 'kg', 1, 44, null, '/seed/kerala/kl-s1-010.svg'),
  ('b1000000-0000-0000-0000-000000000001', 'in-fruits-vegetables', 'KL-S1-011', 'Sambar Onion (Small)', 'Malabar Farms', 'Small shallots for Kerala curries.', true, 0, '0703', '500 g', 'g', 500, 69, null, '/seed/kerala/kl-s1-011.svg'),
  ('b1000000-0000-0000-0000-000000000002', 'in-staples', 'KL-S2-001', 'Kerala Matta Rice (Rosematta)', 'Kochi Choice', 'Red parboiled Kerala matta rice.', false, 5, '1006', '5 kg', 'kg', 5, 349, 379, '/seed/kerala/kl-s2-001.svg'),
  ('b1000000-0000-0000-0000-000000000002', 'in-staples', 'KL-S2-002', 'Ponni Raw Rice', 'Kochi Choice', 'Everyday raw rice.', false, 5, '1006', '5 kg', 'kg', 5, 285, null, '/seed/kerala/kl-s2-002.svg'),
  ('b1000000-0000-0000-0000-000000000002', 'in-staples', 'KL-S2-003', 'Coconut Oil', 'Kera Gold', 'Cold-pressed Kerala coconut oil.', false, 5, '1513', '1 L', 'l', 1, 235, 255, '/seed/kerala/kl-s2-003.svg'),
  ('b1000000-0000-0000-0000-000000000002', 'in-staples', 'KL-S2-004', 'Puttu Podi', 'Kochi Choice', 'Roasted rice flour for puttu.', false, 5, '1102', '1 kg', 'kg', 1, 82, null, '/seed/kerala/kl-s2-004.svg'),
  ('b1000000-0000-0000-0000-000000000002', 'in-staples', 'KL-S2-005', 'Appam Podi', 'Kochi Choice', 'Fine rice flour for appam.', false, 5, '1102', '1 kg', 'kg', 1, 84, null, '/seed/kerala/kl-s2-005.svg'),
  ('b1000000-0000-0000-0000-000000000002', 'in-staples', 'KL-S2-006', 'Black Pepper', 'Malabar Spice', 'Whole Wayanad black pepper.', false, 5, '0904', '100 g', 'g', 100, 89, null, '/seed/kerala/kl-s2-006.svg'),
  ('b1000000-0000-0000-0000-000000000002', 'in-staples', 'KL-S2-007', 'Green Cardamom', 'Malabar Spice', 'Idukki cardamom, 7 mm.', false, 5, '0908', '50 g', 'g', 50, 189, null, '/seed/kerala/kl-s2-007.svg'),
  ('b1000000-0000-0000-0000-000000000002', 'in-staples', 'KL-S2-008', 'Turmeric Powder', 'Malabar Spice', 'Pure ground turmeric.', false, 5, '0910', '200 g', 'g', 200, 62, null, '/seed/kerala/kl-s2-008.svg'),
  ('b1000000-0000-0000-0000-000000000002', 'in-staples', 'KL-S2-009', 'Kashmiri Chilli Powder', 'Malabar Spice', 'Mild, deep-red chilli powder.', false, 5, '0904', '200 g', 'g', 200, 78, null, '/seed/kerala/kl-s2-009.svg'),
  ('b1000000-0000-0000-0000-000000000002', 'in-staples', 'KL-S2-010', 'Toor Dal', 'Kochi Choice', 'Unpolished toor dal.', false, 0, '0713', '1 kg', 'kg', 1, 165, null, '/seed/kerala/kl-s2-010.svg'),
  ('b1000000-0000-0000-0000-000000000002', 'in-staples', 'KL-S2-011', 'Sugar', 'Kochi Choice', 'Fine grain sugar.', false, 5, '1701', '1 kg', 'kg', 1, 46, null, '/seed/kerala/kl-s2-011.svg'),
  ('b1000000-0000-0000-0000-000000000002', 'in-staples', 'KL-S2-012', 'Strong Tea Powder', 'Kochi Choice', 'Strong CTC tea.', false, 5, '0902', '500 g', 'g', 500, 235, null, '/seed/kerala/kl-s2-012.svg'),
  ('b1000000-0000-0000-0000-000000000003', 'in-fish-meat', 'KL-S3-001', 'Sardine (Mathi)', 'Anjengo Catch', 'Cleaned fresh sardine.', true, 0, '0302', '500 g', 'g', 500, 85, null, '/seed/kerala/kl-s3-001.svg'),
  ('b1000000-0000-0000-0000-000000000003', 'in-fish-meat', 'KL-S3-002', 'Kingfish (Neymeen) Steaks', 'Anjengo Catch', 'Fresh kingfish steaks.', true, 0, '0302', '500 g', 'g', 500, 395, null, '/seed/kerala/kl-s3-002.svg'),
  ('b1000000-0000-0000-0000-000000000003', 'in-fish-meat', 'KL-S3-003', 'Pearl Spot (Karimeen)', 'Anjengo Catch', 'Fresh pearl spot, cleaned.', true, 0, '0302', '500 g', 'g', 500, 365, null, '/seed/kerala/kl-s3-003.svg'),
  ('b1000000-0000-0000-0000-000000000003', 'in-fish-meat', 'KL-S3-004', 'Prawns (Medium)', 'Anjengo Catch', 'Cleaned medium prawns.', true, 0, '0306', '500 g', 'g', 500, 340, null, '/seed/kerala/kl-s3-004.svg'),
  ('b1000000-0000-0000-0000-000000000003', 'in-fish-meat', 'KL-S3-005', 'Squid (Koonthal)', 'Anjengo Catch', 'Cleaned squid rings.', true, 0, '0307', '500 g', 'g', 500, 245, null, '/seed/kerala/kl-s3-005.svg'),
  ('b1000000-0000-0000-0000-000000000003', 'in-fish-meat', 'KL-S3-006', 'Chicken (Skinless)', 'Anjengo Meats', 'Fresh broiler chicken, curry cut.', true, 0, '0207', '1 kg', 'kg', 1, 235, null, '/seed/kerala/kl-s3-006.svg'),
  ('b1000000-0000-0000-0000-000000000003', 'in-fish-meat', 'KL-S3-007', 'Beef (With Bone)', 'Anjengo Meats', 'Fresh beef, curry cut.', true, 0, '0201', '1 kg', 'kg', 1, 410, null, '/seed/kerala/kl-s3-007.svg'),
  ('b1000000-0000-0000-0000-000000000003', 'in-fish-meat', 'KL-S3-008', 'Mutton Curry Cut', 'Anjengo Meats', 'Fresh goat meat, curry cut.', true, 0, '0204', '500 g', 'g', 500, 440, null, '/seed/kerala/kl-s3-008.svg'),
  ('b1000000-0000-0000-0000-000000000004', 'in-dairy', 'KL-S4-001', 'Toned Milk', 'Thrissur Dairy', 'Pasteurised toned milk.', false, 0, '0401', '500 ml', 'ml', 500, 29, null, '/seed/kerala/kl-s4-001.svg'),
  ('b1000000-0000-0000-0000-000000000004', 'in-dairy', 'KL-S4-002', 'Fresh Curd', 'Thrissur Dairy', 'Set curd, made daily.', false, 0, '0403', '500 g', 'g', 500, 38, null, '/seed/kerala/kl-s4-002.svg'),
  ('b1000000-0000-0000-0000-000000000004', 'in-dairy', 'KL-S4-003', 'Paneer', 'Thrissur Dairy', 'Fresh cottage cheese.', false, 5, '0406', '200 g', 'g', 200, 98, null, '/seed/kerala/kl-s4-003.svg'),
  ('b1000000-0000-0000-0000-000000000004', 'in-dairy', 'KL-S4-004', 'Salted Butter', 'Thrissur Dairy', 'Creamy table butter.', false, 12, '0405', '100 g', 'g', 100, 62, null, '/seed/kerala/kl-s4-004.svg'),
  ('b1000000-0000-0000-0000-000000000004', 'in-dairy', 'KL-S4-005', 'Cow Ghee', 'Thrissur Dairy', 'Pure cow ghee.', false, 12, '0405', '500 ml', 'ml', 500, 335, 359, '/seed/kerala/kl-s4-005.svg'),
  ('b1000000-0000-0000-0000-000000000004', 'in-dairy', 'KL-S4-006', 'Farm Eggs', 'Thrissur Dairy', 'Farm-fresh eggs.', true, 0, '0407', '12 pcs', 'unit', 12, 84, null, '/seed/kerala/kl-s4-006.svg'),
  ('b1000000-0000-0000-0000-000000000004', 'in-bakery', 'KL-S4-007', 'Sandwich Bread', 'Thrissur Bakes', 'Soft white sandwich bread.', false, 0, '1905', '400 g', 'g', 400, 45, null, '/seed/kerala/kl-s4-007.svg'),
  ('b1000000-0000-0000-0000-000000000004', 'in-bakery', 'KL-S4-008', 'Kerala Parotta', 'Thrissur Bakes', 'Layered parotta, pack of 5.', false, 18, '1905', '5 pcs', 'unit', 5, 60, null, '/seed/kerala/kl-s4-008.svg'),
  ('b1000000-0000-0000-0000-000000000004', 'in-bakery', 'KL-S4-009', 'Plum Cake', 'Thrissur Bakes', 'Rich fruit plum cake.', false, 18, '1905', '400 g', 'g', 400, 220, null, '/seed/kerala/kl-s4-009.svg'),
  ('b1000000-0000-0000-0000-000000000004', 'in-bakery', 'KL-S4-010', 'Tea Rusk', 'Thrissur Bakes', 'Crunchy rusk for tea time.', false, 18, '1905', '200 g', 'g', 200, 45, null, '/seed/kerala/kl-s4-010.svg'),
  ('b1000000-0000-0000-0000-000000000005', 'in-snacks', 'KL-S5-001', 'Banana Chips', 'Kannur Snacks', 'Coconut-oil fried nendran chips.', false, 12, '2008', '250 g', 'g', 250, 95, null, '/seed/kerala/kl-s5-001.svg'),
  ('b1000000-0000-0000-0000-000000000005', 'in-snacks', 'KL-S5-002', 'Jackfruit Chips', 'Kannur Snacks', 'Crisp jackfruit chips.', false, 12, '2008', '200 g', 'g', 200, 110, null, '/seed/kerala/kl-s5-002.svg'),
  ('b1000000-0000-0000-0000-000000000005', 'in-snacks', 'KL-S5-003', 'Kozhikode Halwa', 'Kannur Snacks', 'Classic sweet halwa.', false, 18, '1704', '250 g', 'g', 250, 140, null, '/seed/kerala/kl-s5-003.svg'),
  ('b1000000-0000-0000-0000-000000000005', 'in-snacks', 'KL-S5-004', 'Kerala Mixture', 'Kannur Snacks', 'Spicy tea-time mixture.', false, 12, '1904', '200 g', 'g', 200, 60, null, '/seed/kerala/kl-s5-004.svg'),
  ('b1000000-0000-0000-0000-000000000005', 'in-beverages', 'KL-S5-005', 'Packaged Drinking Water', 'Aqua Kerala', 'Packaged drinking water.', false, 18, '2201', '1 L', 'l', 1, 20, null, '/seed/kerala/kl-s5-005.svg'),
  ('b1000000-0000-0000-0000-000000000005', 'in-beverages', 'KL-S5-006', 'Cola', 'Fizz', 'Carbonated soft drink.', false, 28, '2202', '750 ml', 'ml', 750, 40, null, '/seed/kerala/kl-s5-006.svg'),
  ('b1000000-0000-0000-0000-000000000005', 'in-beverages', 'KL-S5-007', 'Mango Juice', 'Fruitful', 'Fruit drink, mango.', false, 12, '2202', '1 L', 'l', 1, 115, 125, '/seed/kerala/kl-s5-007.svg'),
  ('b1000000-0000-0000-0000-000000000005', 'in-beverages', 'KL-S5-008', 'Instant Coffee', 'Brew', 'Classic instant coffee.', false, 18, '2101', '100 g', 'g', 100, 320, 345, '/seed/kerala/kl-s5-008.svg'),
  ('b1000000-0000-0000-0000-000000000005', 'in-household', 'KL-S5-009', 'Dishwash Liquid', 'Sparkle', 'Lemon dishwash liquid.', false, 18, '3402', '500 ml', 'ml', 500, 105, 115, '/seed/kerala/kl-s5-009.svg'),
  ('b1000000-0000-0000-0000-000000000005', 'in-household', 'KL-S5-010', 'Laundry Detergent', 'Sparkle', 'Easy-wash detergent powder.', false, 18, '3402', '1 kg', 'kg', 1, 135, 145, '/seed/kerala/kl-s5-010.svg'),
  ('b1000000-0000-0000-0000-000000000005', 'in-household', 'KL-S5-011', 'Bathing Soap (3 pack)', 'Fresh', 'Moisturising bathing soap.', false, 18, '3401', '3 x 75 g', 'unit', 3, 125, 135, '/seed/kerala/kl-s5-011.svg'),
  ('b1000000-0000-0000-0000-000000000005', 'in-household', 'KL-S5-012', 'Toothpaste', 'Smile', 'Fluoride toothpaste.', false, 18, '3306', '200 g', 'g', 200, 115, 125, '/seed/kerala/kl-s5-012.svg');
insert into products (store_id, category_id, sku, name, brand, description, is_fresh, tax_rate, hsn_code, image_url, tenant_id)
select k.store_id, c.id, k.sku, k.name, k.brand, k.descr, k.fresh, k.tax, k.hsn, k.image, '00000000-0000-0000-0000-0000000000a2'
from _kl_seed k join categories c on c.slug = k.cat
on conflict (sku) do nothing;
insert into product_variants (product_id, label, unit, quantity, price, compare_at_price, is_default, tenant_id)
select p.id, k.label, k.unit, k.qty, k.price, k.mrp, true, '00000000-0000-0000-0000-0000000000a2'
from _kl_seed k join products p on p.sku = k.sku
where not exists (select 1 from product_variants v where v.product_id = p.id);
insert into inventory (variant_id, warehouse_id, stock, min_stock, tenant_id)
select v.id, s.warehouse_id, 60, 10, '00000000-0000-0000-0000-0000000000a2'
from product_variants v join products p on p.id = v.product_id join stores s on s.id = p.store_id
where p.sku like 'KL-S%'
on conflict (variant_id, warehouse_id) do nothing;

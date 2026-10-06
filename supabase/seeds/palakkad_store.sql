-- New supplier "Palakkad Store Grocery" (Palakkad, Kerala) with 50 grocery products, photos, GST slabs, HSN codes and stock.
-- Run ONCE in the Supabase SQL editor. Safe to re-run. Needs the Kerala launch seed's categories (it creates them if missing).
-- Owner login: shameerck007+kl-store6@gmail.com (use "Sign in with a code"). Edit the store in Admin > Merchants to add its
-- real PAN / GSTIN / FSSAI, bank details, phone and address before real orders. No blank lines inside statements.
insert into categories (name, slug, icon, sort_order, tenant_id) values
  ('Rice, Spices & Staples', 'in-staples', 'shopping-basket', 2, '00000000-0000-0000-0000-0000000000a2')
on conflict (slug) do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
select '00000000-0000-0000-0000-000000000000', 'b2000000-0000-0000-0000-000000000006'::uuid, 'authenticated', 'authenticated', 'shameerck007+kl-store6@gmail.com', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', 'Palakkad Store Grocery (owner)', 'tenant_id', '00000000-0000-0000-0000-0000000000a2'), now(), now(), '', '', '', ''
where not exists (select 1 from auth.users u where u.id = 'b2000000-0000-0000-0000-000000000006'::uuid);
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
from auth.users u
where u.id = 'b2000000-0000-0000-0000-000000000006'::uuid
and not exists (select 1 from auth.identities i where i.user_id = u.id);
insert into profiles (id, full_name, tenant_id)
select u.id, u.raw_user_meta_data ->> 'full_name', '00000000-0000-0000-0000-0000000000a2'
from auth.users u
where u.id = 'b2000000-0000-0000-0000-000000000006'::uuid
on conflict (id) do nothing;
update profiles set role = 'merchant', tenant_id = '00000000-0000-0000-0000-0000000000a2' where id = 'b2000000-0000-0000-0000-000000000006';
insert into warehouses (id, name, address_line, lat, lng, is_active, delivery_radius_km, standard_delivery_enabled, standard_delivery_days, standard_radius_km, tenant_id) values
  ('b3000000-0000-0000-0000-000000000006', 'Palakkad Store Grocery (Merchant)', 'Palakkad, Kerala 678001', 10.7867, 76.6548, true, 12, true, 1, 100, '00000000-0000-0000-0000-0000000000a2')
on conflict (id) do nothing;
insert into stores (id, owner_id, name, cr_number, city, state, country, status, warehouse_id, address_line, tagline, logo_url, cover_url, tenant_id) values
  ('b1000000-0000-0000-0000-000000000006', 'b2000000-0000-0000-0000-000000000006', 'Palakkad Store Grocery', 'PENDING-PAN', 'Palakkad', 'Kerala', 'India', 'approved', 'b3000000-0000-0000-0000-000000000006', 'Palakkad, Kerala 678001', 'Rice, pulses, spices and everyday grocery from the rice bowl of Kerala', '/seed/kerala/s6-logo.svg', '/seed/kerala/s6-cover-photo.jpg', '00000000-0000-0000-0000-0000000000a2')
on conflict (id) do nothing;
create temp table _pk_seed (sku text, name text, brand text, descr text, tax numeric, hsn text, label text, unit text, qty numeric, price numeric, mrp numeric, image text);
insert into _pk_seed values
  ('KL-S6-001', 'Palakkadan Matta Rice', 'Palakkad Gold', 'Red parboiled matta rice from the Palakkad paddy fields.', 5, '1006', '5 kg', 'kg', 5, 385, 420, '/seed/kerala/kl-s6-001.jpg'),
  ('KL-S6-002', 'Kuruva Rice', 'Palakkad Gold', 'Everyday Kuruva rice.', 5, '1006', '5 kg', 'kg', 5, 329, null, '/seed/kerala/kl-s6-002.jpg'),
  ('KL-S6-003', 'Jeerakasala Rice', 'Palakkad Gold', 'Short-grain aromatic rice for biriyani and ghee rice.', 5, '1006', '1 kg', 'kg', 1, 169, 179, '/seed/kerala/kl-s6-003.jpg'),
  ('KL-S6-004', 'Basmati Rice', 'Palakkad Gold', 'Long-grain basmati rice.', 5, '1006', '1 kg', 'kg', 1, 135, null, '/seed/kerala/kl-s6-004.jpg'),
  ('KL-S6-005', 'Brown Rice', 'Palakkad Gold', 'Unpolished brown rice.', 5, '1006', '1 kg', 'kg', 1, 110, null, '/seed/kerala/kl-s6-005.jpg'),
  ('KL-S6-006', 'Poha (Aval)', 'Palakkad Gold', 'Flattened rice for breakfast and snacks.', 5, '1904', '500 g', 'g', 500, 48, null, '/seed/kerala/kl-s6-006.jpg'),
  ('KL-S6-007', 'Semolina (Rava)', 'Palakkad Gold', 'Fine rava for upma and sweets.', 5, '1103', '1 kg', 'kg', 1, 58, null, '/seed/kerala/kl-s6-007.jpg'),
  ('KL-S6-008', 'Vermicelli (Semiya)', 'Palakkad Gold', 'Roasted vermicelli for payasam and upma.', 5, '1902', '500 g', 'g', 500, 52, null, '/seed/kerala/kl-s6-008.jpg'),
  ('KL-S6-009', 'Whole Wheat Atta', 'Palakkad Gold', 'Stone-ground whole wheat flour.', 5, '1101', '5 kg', 'kg', 5, 265, 285, '/seed/kerala/kl-s6-009.jpg'),
  ('KL-S6-010', 'Maida', 'Palakkad Gold', 'Refined wheat flour.', 5, '1101', '1 kg', 'kg', 1, 46, null, '/seed/kerala/kl-s6-010.jpg'),
  ('KL-S6-011', 'Ragi Flour', 'Palakkad Gold', 'Finger millet flour for puttu, dosa and porridge.', 5, '1102', '500 g', 'g', 500, 58, null, '/seed/kerala/kl-s6-011.jpg'),
  ('KL-S6-012', 'Besan (Gram Flour)', 'Palakkad Gold', 'Fine gram flour.', 5, '1106', '500 g', 'g', 500, 68, null, '/seed/kerala/kl-s6-012.jpg'),
  ('KL-S6-013', 'Rice Flour', 'Palakkad Gold', 'Fine rice flour for appam, pathiri and idiyappam.', 5, '1102', '1 kg', 'kg', 1, 62, null, '/seed/kerala/kl-s6-013.jpg'),
  ('KL-S6-014', 'Toor Dal', 'Palakkad Gold', 'Unpolished toor dal.', 5, '0713', '1 kg', 'kg', 1, 165, 175, '/seed/kerala/kl-s6-014.jpg'),
  ('KL-S6-015', 'Chana Dal', 'Palakkad Gold', 'Split Bengal gram.', 5, '0713', '1 kg', 'kg', 1, 118, null, '/seed/kerala/kl-s6-015.jpg'),
  ('KL-S6-016', 'Moong Dal', 'Palakkad Gold', 'Split green gram.', 5, '0713', '1 kg', 'kg', 1, 135, null, '/seed/kerala/kl-s6-016.jpg'),
  ('KL-S6-017', 'Cherupayar (Whole Green Gram)', 'Palakkad Gold', 'Whole green gram for curries and thoran.', 5, '0713', '500 g', 'g', 500, 78, null, '/seed/kerala/kl-s6-017.jpg'),
  ('KL-S6-018', 'Urad Dal', 'Palakkad Gold', 'Split black gram for idli and dosa.', 5, '0713', '1 kg', 'kg', 1, 152, null, '/seed/kerala/kl-s6-018.jpg'),
  ('KL-S6-019', 'Masoor Dal', 'Palakkad Gold', 'Red lentils.', 5, '0713', '500 g', 'g', 500, 68, null, '/seed/kerala/kl-s6-019.jpg'),
  ('KL-S6-020', 'Kabuli Chana', 'Palakkad Gold', 'Large white chickpeas.', 5, '0713', '500 g', 'g', 500, 85, null, '/seed/kerala/kl-s6-020.jpg'),
  ('KL-S6-021', 'Rajma', 'Palakkad Gold', 'Red kidney beans.', 5, '0713', '500 g', 'g', 500, 95, null, '/seed/kerala/kl-s6-021.jpg'),
  ('KL-S6-022', 'Horse Gram (Muthira)', 'Palakkad Gold', 'Whole horse gram.', 5, '0713', '500 g', 'g', 500, 62, null, '/seed/kerala/kl-s6-022.jpg'),
  ('KL-S6-023', 'Sugar', 'Palakkad Gold', 'Fine grain sugar.', 5, '1701', '1 kg', 'kg', 1, 46, null, '/seed/kerala/kl-s6-023.jpg'),
  ('KL-S6-024', 'Jaggery (Sharkara)', 'Palakkad Gold', 'Natural sugarcane jaggery.', 0, '1701', '500 g', 'g', 500, 68, null, '/seed/kerala/kl-s6-024.jpg'),
  ('KL-S6-025', 'Iodised Salt', 'Palakkad Gold', 'Free-flow iodised salt.', 0, '2501', '1 kg', 'kg', 1, 24, null, '/seed/kerala/kl-s6-025.jpg'),
  ('KL-S6-026', 'Coconut Oil', 'Kera Pride', 'Pure Kerala coconut oil.', 5, '1513', '1 L', 'l', 1, 235, 255, '/seed/kerala/kl-s6-026.jpg'),
  ('KL-S6-027', 'Sunflower Oil', 'Palakkad Gold', 'Refined sunflower oil.', 5, '1512', '1 L', 'l', 1, 142, 155, '/seed/kerala/kl-s6-027.jpg'),
  ('KL-S6-028', 'Groundnut Oil', 'Palakkad Gold', 'Filtered groundnut oil.', 5, '1508', '1 L', 'l', 1, 198, null, '/seed/kerala/kl-s6-028.jpg'),
  ('KL-S6-029', 'Gingelly (Sesame) Oil', 'Palakkad Gold', 'Cold-pressed sesame oil.', 5, '1515', '500 ml', 'ml', 500, 245, null, '/seed/kerala/kl-s6-029.jpg'),
  ('KL-S6-030', 'Coriander Powder', 'Palakkad Spice', 'Freshly ground coriander.', 5, '0909', '200 g', 'g', 200, 54, null, '/seed/kerala/kl-s6-030.jpg'),
  ('KL-S6-031', 'Cumin Seeds (Jeera)', 'Palakkad Spice', 'Whole cumin seeds.', 5, '0909', '100 g', 'g', 100, 62, null, '/seed/kerala/kl-s6-031.jpg'),
  ('KL-S6-032', 'Mustard Seeds', 'Palakkad Spice', 'Small mustard seeds for tempering.', 5, '1207', '200 g', 'g', 200, 36, null, '/seed/kerala/kl-s6-032.jpg'),
  ('KL-S6-033', 'Fenugreek Seeds (Uluva)', 'Palakkad Spice', 'Whole fenugreek seeds.', 5, '0909', '100 g', 'g', 100, 28, null, '/seed/kerala/kl-s6-033.jpg'),
  ('KL-S6-034', 'Fennel Seeds (Perumjeerakam)', 'Palakkad Spice', 'Whole fennel seeds.', 5, '0909', '100 g', 'g', 100, 44, null, '/seed/kerala/kl-s6-034.jpg'),
  ('KL-S6-035', 'Cloves (Grambu)', 'Palakkad Spice', 'Whole cloves.', 5, '0907', '50 g', 'g', 50, 78, null, '/seed/kerala/kl-s6-035.jpg'),
  ('KL-S6-036', 'Cinnamon (Karuvapatta)', 'Palakkad Spice', 'Cinnamon sticks.', 5, '0906', '50 g', 'g', 50, 52, null, '/seed/kerala/kl-s6-036.jpg'),
  ('KL-S6-037', 'Dry Red Chilli', 'Palakkad Spice', 'Whole dried red chillies.', 5, '0904', '200 g', 'g', 200, 88, null, '/seed/kerala/kl-s6-037.jpg'),
  ('KL-S6-038', 'Garam Masala', 'Palakkad Spice', 'Aromatic garam masala blend.', 5, '0910', '100 g', 'g', 100, 58, null, '/seed/kerala/kl-s6-038.jpg'),
  ('KL-S6-039', 'Sambar Powder', 'Palakkad Spice', 'Kerala-style sambar powder.', 5, '0910', '200 g', 'g', 200, 72, null, '/seed/kerala/kl-s6-039.jpg'),
  ('KL-S6-040', 'Black Pepper', 'Palakkad Spice', 'Whole black pepper.', 5, '0904', '100 g', 'g', 100, 89, null, '/seed/kerala/kl-s6-040.jpg'),
  ('KL-S6-041', 'Tamarind (Puli)', 'Palakkad Spice', 'Seedless dry tamarind.', 5, '0813', '250 g', 'g', 250, 62, null, '/seed/kerala/kl-s6-041.jpg'),
  ('KL-S6-042', 'Cashew Nuts', 'Palakkad Dry Fruits', 'Whole cashew kernels.', 5, '0801', '250 g', 'g', 250, 225, 245, '/seed/kerala/kl-s6-042.jpg'),
  ('KL-S6-043', 'Raisins', 'Palakkad Dry Fruits', 'Seedless raisins.', 12, '0806', '250 g', 'g', 250, 95, null, '/seed/kerala/kl-s6-043.jpg'),
  ('KL-S6-044', 'Almonds', 'Palakkad Dry Fruits', 'California almonds.', 12, '0802', '250 g', 'g', 250, 245, null, '/seed/kerala/kl-s6-044.jpg'),
  ('KL-S6-045', 'Dates', 'Palakkad Dry Fruits', 'Soft dried dates.', 12, '0804', '500 g', 'g', 500, 135, null, '/seed/kerala/kl-s6-045.jpg'),
  ('KL-S6-046', 'Tea Dust', 'Palakkad Gold', 'Strong CTC tea dust.', 5, '0902', '500 g', 'g', 500, 235, null, '/seed/kerala/kl-s6-046.jpg'),
  ('KL-S6-047', 'Filter Coffee Powder', 'Palakkad Gold', 'Roasted and ground coffee-chicory blend.', 5, '0901', '250 g', 'g', 250, 165, null, '/seed/kerala/kl-s6-047.jpg'),
  ('KL-S6-048', 'Pappadam', 'Palakkad Gold', 'Crisp urad pappadam.', 0, '1905', '200 g', 'g', 200, 58, null, '/seed/kerala/kl-s6-048.jpg'),
  ('KL-S6-049', 'Honey', 'Palakkad Gold', 'Pure forest honey.', 5, '0409', '500 g', 'g', 500, 245, 265, '/seed/kerala/kl-s6-049.jpg'),
  ('KL-S6-050', 'Mango Pickle', 'Palakkad Gold', 'Kerala-style raw mango pickle.', 12, '2001', '400 g', 'g', 400, 115, null, '/seed/kerala/kl-s6-050.jpg');
insert into products (store_id, category_id, sku, name, brand, description, is_fresh, tax_rate, hsn_code, image_url, tenant_id)
select 'b1000000-0000-0000-0000-000000000006', c.id, k.sku, k.name, k.brand, k.descr, false, k.tax, k.hsn, k.image, '00000000-0000-0000-0000-0000000000a2'
from _pk_seed k, categories c
where c.slug = 'in-staples'
on conflict (sku) do nothing;
insert into product_variants (product_id, label, unit, quantity, price, compare_at_price, is_default, tenant_id)
select p.id, k.label, k.unit, k.qty, k.price, k.mrp, true, '00000000-0000-0000-0000-0000000000a2'
from _pk_seed k join products p on p.sku = k.sku
where not exists (select 1 from product_variants v where v.product_id = p.id);
insert into inventory (variant_id, warehouse_id, stock, min_stock, tenant_id)
select v.id, 'b3000000-0000-0000-0000-000000000006', 80, 10, '00000000-0000-0000-0000-0000000000a2'
from product_variants v join products p on p.id = v.product_id
where p.sku like 'KL-S6-%'
on conflict (variant_id, warehouse_id) do nothing;
-- Real pictures for the India "Shop by category" tiles (the app also falls back to these files by itself).
update categories set image_url = '/seed/kerala/cat-' || slug || '.jpg' where slug in ('in-fruits-vegetables','in-staples','in-fish-meat','in-dairy','in-bakery','in-snacks','in-beverages','in-household') and image_url is null;

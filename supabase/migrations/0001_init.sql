-- FasTrack Shop — Phase 1 MVP schema
-- Own-inventory quick-commerce: customers, single warehouse, riders, admin.
-- Multi-vendor tables (stores/merchants/commission) are deferred to Phase 2.

create extension if not exists "pgcrypto";

-- ============================================================
-- Enums
-- ============================================================

create type user_role as enum ('customer', 'admin', 'rider');
create type address_label as enum ('home', 'office', 'other');
create type order_status as enum (
  'pending',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'rider_assigned',
  'out_for_delivery',
  'delivered',
  'cancelled'
);
create type payment_method as enum ('mada', 'visa', 'mastercard', 'apple_pay', 'cash_on_delivery');
create type payment_status as enum ('pending', 'authorized', 'paid', 'failed', 'refunded');
create type delivery_type as enum ('express', 'standard', 'scheduled');
create type substitution_preference as enum ('allow', 'contact_me', 'refund');
create type promotion_type as enum ('percentage', 'fixed', 'buy_x_get_y', 'category', 'free_delivery');

-- ============================================================
-- Users & profiles (extends auth.users)
-- ============================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'customer',
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  label address_label not null default 'home',
  address_line text not null,
  city text not null default 'Riyadh',
  lat double precision,
  lng double precision,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Catalog
-- ============================================================

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_ar text,
  slug text not null unique,
  icon text,
  sort_order int not null default 0,
  parent_id uuid references categories(id) on delete set null,
  created_at timestamptz not null default now()
);

create table warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address_line text,
  lat double precision,
  lng double precision,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete set null,
  sku text unique,
  barcode text,
  name text not null,
  name_ar text,
  brand text,
  description text,
  origin text,
  image_url text,
  is_fresh boolean not null default false,
  is_variable_weight boolean not null default false,
  price_per_kg numeric(10, 2),
  vat_rate numeric(5, 4) not null default 0.15,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create extension if not exists pg_trgm;

create index products_category_idx on products(category_id);
create index products_name_trgm_idx on products using gin (name gin_trgm_ops);

-- One row per purchasable unit (e.g. "1 kg", "500 g", "6-pack")
create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  label text not null,
  unit text not null default 'unit',
  quantity numeric(10, 3) not null default 1,
  price numeric(10, 2) not null,
  compare_at_price numeric(10, 2),
  is_default boolean not null default true,
  created_at timestamptz not null default now()
);

create index product_variants_product_idx on product_variants(product_id);

create table inventory (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references product_variants(id) on delete cascade,
  warehouse_id uuid not null references warehouses(id) on delete cascade,
  stock numeric(10, 3) not null default 0,
  min_stock numeric(10, 3) not null default 0,
  batch_number text,
  expiry_date date,
  updated_at timestamptz not null default now(),
  unique (variant_id, warehouse_id)
);

-- ============================================================
-- Cart
-- ============================================================

create table carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade unique,
  updated_at timestamptz not null default now()
);

create table cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete cascade,
  quantity numeric(10, 3) not null default 1,
  substitution_preference substitution_preference not null default 'allow',
  created_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);

-- ============================================================
-- Orders
-- ============================================================

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references profiles(id),
  address_id uuid references addresses(id),
  warehouse_id uuid references warehouses(id),
  status order_status not null default 'pending',
  delivery_type delivery_type not null default 'standard',
  scheduled_for timestamptz,
  subtotal numeric(10, 2) not null default 0,
  delivery_fee numeric(10, 2) not null default 0,
  discount numeric(10, 2) not null default 0,
  vat numeric(10, 2) not null default 0,
  total numeric(10, 2) not null default 0,
  coupon_code text,
  delivery_otp text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_user_idx on orders(user_id);
create index orders_status_idx on orders(status);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  variant_id uuid not null references product_variants(id),
  product_name text not null,
  variant_label text not null,
  ordered_quantity numeric(10, 3) not null,
  packed_quantity numeric(10, 3),
  unit_price numeric(10, 2) not null,
  line_total numeric(10, 2) not null,
  is_substituted boolean not null default false,
  substituted_variant_id uuid references product_variants(id),
  created_at timestamptz not null default now()
);

create table order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  status order_status not null,
  note text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Delivery
-- ============================================================

create table delivery_partners (
  id uuid primary key references profiles(id) on delete cascade,
  vehicle_type text,
  is_available boolean not null default true,
  current_lat double precision,
  current_lng double precision,
  rating numeric(3, 2),
  created_at timestamptz not null default now()
);

create table delivery_assignments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade unique,
  rider_id uuid references delivery_partners(id),
  assigned_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  route_sequence int,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Payments
-- ============================================================

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  method payment_method not null,
  status payment_status not null default 'pending',
  amount numeric(10, 2) not null,
  provider_reference text,
  created_at timestamptz not null default now()
);

create table refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  payment_id uuid references payments(id),
  amount numeric(10, 2) not null,
  reason text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- ============================================================
-- Promotions
-- ============================================================

create table promotions (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  type promotion_type not null,
  value numeric(10, 2),
  min_order_amount numeric(10, 2),
  category_id uuid references categories(id),
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit int,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Reviews
-- ============================================================

create table reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  order_id uuid references orders(id),
  rating int not null check (rating between 1 and 5),
  comment text,
  -- Denormalized at insert time rather than joined from profiles, so the
  -- public review list doesn't need a broad "profiles are publicly
  -- readable" policy that would also leak phone numbers.
  reviewer_name text,
  created_at timestamptz not null default now()
);

create index reviews_product_idx on reviews(product_id);

create view product_ratings
with (security_invoker = true) as
select
  product_id,
  round(avg(rating)::numeric, 1) as avg_rating,
  count(*) as review_count
from reviews
group by product_id;

-- ============================================================
-- updated_at triggers
-- ============================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger products_set_updated_at before update on products
  for each row execute function set_updated_at();
create trigger orders_set_updated_at before update on orders
  for each row execute function set_updated_at();
create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name, phone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Atomic, race-safe stock decrement for checkout. A conditional UPDATE
-- (stock >= qty in the WHERE clause) is used instead of read-then-write
-- from the application, so two concurrent checkouts can't both succeed
-- against the same last unit. Raises if there isn't enough stock, which
-- the caller surfaces as a checkout error.
create or replace function decrement_stock(p_variant_id uuid, p_warehouse_id uuid, p_qty numeric)
returns void as $$
declare
  updated_rows int;
begin
  update inventory
  set stock = stock - p_qty
  where variant_id = p_variant_id
    and warehouse_id = p_warehouse_id
    and stock >= p_qty;

  get diagnostics updated_rows = row_count;
  if updated_rows = 0 then
    raise exception 'insufficient_stock' using errcode = 'P0001';
  end if;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function decrement_stock(uuid, uuid, numeric) to authenticated;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table profiles enable row level security;
alter table addresses enable row level security;
alter table categories enable row level security;
alter table warehouses enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table inventory enable row level security;
alter table carts enable row level security;
alter table cart_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_status_history enable row level security;
alter table delivery_partners enable row level security;
alter table delivery_assignments enable row level security;
alter table payments enable row level security;
alter table refunds enable row level security;
alter table promotions enable row level security;
alter table reviews enable row level security;

create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer;

create or replace function is_rider()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'rider'
  );
$$ language sql stable security definer;

-- Public catalog: anyone can read active categories/products/variants/promotions
create policy "categories are publicly readable" on categories for select using (true);
create policy "warehouses are publicly readable" on warehouses for select using (true);
create policy "admins manage warehouses" on warehouses for all using (is_admin()) with check (is_admin());
create policy "products are publicly readable" on products for select using (is_active or is_admin());
create policy "variants are publicly readable" on product_variants for select using (true);
create policy "inventory is publicly readable" on inventory for select using (true);
create policy "active promotions are publicly readable" on promotions for select using (is_active or is_admin());
create policy "admins manage categories" on categories for all using (is_admin()) with check (is_admin());
create policy "admins manage products" on products for all using (is_admin()) with check (is_admin());
create policy "admins manage variants" on product_variants for all using (is_admin()) with check (is_admin());
create policy "admins manage inventory" on inventory for all using (is_admin()) with check (is_admin());
create policy "admins manage promotions" on promotions for all using (is_admin()) with check (is_admin());

-- Profiles: users see/edit their own row; admins see all
create policy "users read own profile" on profiles for select using (auth.uid() = id or is_admin());
create policy "users update own profile" on profiles for update using (auth.uid() = id);
create policy "users insert own profile" on profiles for insert with check (auth.uid() = id);

-- Addresses: owner only, admin full
create policy "users manage own addresses" on addresses for all
  using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());

-- Cart: owner only
create policy "users manage own cart" on carts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users manage own cart items" on cart_items for all
  using (exists (select 1 from carts where carts.id = cart_id and carts.user_id = auth.uid()))
  with check (exists (select 1 from carts where carts.id = cart_id and carts.user_id = auth.uid()));

-- Cross-table checks below run as SECURITY DEFINER (bypassing RLS on the
-- tables they query internally) rather than as inline EXISTS subqueries in a
-- USING clause. orders <-> delivery_assignments policies both reference the
-- other table, so inline subqueries would make Postgres evaluate each
-- table's RLS while evaluating the other's, recursing forever (error 42P17).
create or replace function is_assigned_rider(target_order_id uuid)
returns boolean as $$
  select exists (
    select 1 from delivery_assignments
    where order_id = target_order_id and rider_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

create or replace function is_order_owner(target_order_id uuid)
returns boolean as $$
  select exists (
    select 1 from orders where id = target_order_id and user_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

-- Orders: owner can read own; admin full; rider can read assigned
create policy "users read own orders" on orders for select using (
  auth.uid() = user_id or is_admin() or is_assigned_rider(id)
);
create policy "users create own orders" on orders for insert with check (auth.uid() = user_id);
create policy "admins and assigned riders update orders" on orders for update using (
  is_admin() or (is_rider() and is_assigned_rider(id))
);

-- Unassigned orders the store has started preparing are the "available pool"
-- online riders can browse and self-assign from.
create policy "riders view available order pool" on orders for select using (
  is_rider() and status in ('preparing', 'ready_for_pickup')
  and not exists (select 1 from delivery_assignments da where da.order_id = orders.id)
);

create policy "users read own order items" on order_items for select using (
  exists (
    select 1 from orders o where o.id = order_id and o.user_id = auth.uid()
  ) or is_admin() or is_assigned_rider(order_id)
);
create policy "users insert own order items" on order_items for insert with check (
  exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid())
);
create policy "admins manage order items" on order_items for all using (is_admin()) with check (is_admin());
create policy "riders view available pool items" on order_items for select using (
  exists (
    select 1 from orders o
    where o.id = order_id
      and is_rider()
      and o.status in ('preparing', 'ready_for_pickup')
      and not exists (select 1 from delivery_assignments da where da.order_id = o.id)
  )
);

create policy "users read own order history" on order_status_history for select using (
  exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid())
  or is_admin() or is_assigned_rider(order_id)
);
create policy "users insert own order history" on order_status_history for insert with check (
  exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid())
);
create policy "admins and assigned riders manage order history" on order_status_history for all using (
  is_admin() or (is_rider() and is_assigned_rider(order_id))
) with check (
  is_admin() or (is_rider() and is_assigned_rider(order_id))
);

-- A rider assigned to an order can see the customer's delivery address for it
-- (in addition to the owner/admin access already granted above).
create policy "assigned riders read delivery address" on addresses for select using (
  exists (
    select 1 from orders o
    where o.address_id = addresses.id and is_assigned_rider(o.id)
  )
);

-- A rider assigned to an order can see the customer's name/phone for it
-- (in addition to the owner/admin access already granted above).
create policy "assigned riders read customer profile" on profiles for select using (
  exists (
    select 1 from orders o where o.user_id = profiles.id and is_assigned_rider(o.id)
  )
);

-- Delivery
create policy "riders read own profile" on delivery_partners for select using (auth.uid() = id or is_admin());
create policy "riders update own profile" on delivery_partners for update using (auth.uid() = id or is_admin());
create policy "admins insert riders" on delivery_partners for insert with check (is_admin());

create policy "riders read own assignments" on delivery_assignments for select using (
  rider_id = auth.uid() or is_admin() or is_order_owner(order_id)
);
create policy "admins manage assignments" on delivery_assignments for insert with check (is_admin());
create policy "riders accept available orders" on delivery_assignments for insert with check (
  rider_id = auth.uid()
  and exists (
    select 1 from orders o where o.id = order_id and o.status in ('preparing', 'ready_for_pickup')
  )
);
create policy "riders update own assignments" on delivery_assignments for update using (rider_id = auth.uid() or is_admin());

-- Payments / refunds: owner + admin
create policy "users read own payments" on payments for select using (
  exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or is_admin()))
);
create policy "users insert own payments" on payments for insert with check (
  exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid())
);
create policy "admins manage payments" on payments for all using (is_admin()) with check (is_admin());
create policy "users read own refunds" on refunds for select using (
  exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or is_admin()))
);
create policy "admins manage refunds" on refunds for all using (is_admin()) with check (is_admin());

-- Reviews: public read, owner write
create policy "reviews are publicly readable" on reviews for select using (true);
create policy "users create own reviews" on reviews for insert with check (auth.uid() = user_id);
create policy "users update own reviews" on reviews for update using (auth.uid() = user_id);

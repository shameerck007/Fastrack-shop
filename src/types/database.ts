// Hand-written types matching supabase/migrations/0001_init.sql.
// Regenerate with `supabase gen types typescript` once a live project exists,
// and this file can be replaced wholesale.

export type UserRole = "customer" | "admin" | "rider" | "merchant";
export type StoreStatus = "pending" | "approved" | "rejected" | "suspended";
export type AddressLabel = "home" | "office" | "other";
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready_for_pickup"
  | "rider_assigned"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";
export type PaymentMethod = "mada" | "visa" | "mastercard" | "apple_pay" | "cash_on_delivery";
export type PaymentStatus = "pending" | "authorized" | "paid" | "failed" | "refunded";
export type DeliveryType = "express" | "standard" | "scheduled";
export type SubstitutionPreference = "allow" | "contact_me" | "refund";
export type PromotionType = "percentage" | "fixed" | "buy_x_get_y" | "category" | "free_delivery";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  label: AddressLabel;
  address_line: string;
  city: string;
  district: string | null;
  building_number: string | null;
  additional_number: string | null;
  unit_number: string | null;
  postal_code: string | null;
  short_address: string | null;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  name_ar: string | null;
  slug: string;
  icon: string | null;
  sort_order: number;
  parent_id: string | null;
  created_at: string;
}

export interface Warehouse {
  id: string;
  name: string;
  address_line: string | null;
  lat: number | null;
  lng: number | null;
  is_active: boolean;
  created_at: string;
}

export interface Store {
  id: string;
  owner_id: string;
  name: string;
  cr_number: string;
  vat_number: string | null;
  bank_name: string | null;
  bank_iban: string | null;
  contact_phone: string | null;
  address_line: string | null;
  city: string;
  status: StoreStatus;
  rejection_reason: string | null;
  warehouse_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  category_id: string | null;
  store_id: string | null;
  sku: string | null;
  barcode: string | null;
  name: string;
  name_ar: string | null;
  brand: string | null;
  description: string | null;
  origin: string | null;
  image_url: string | null;
  is_fresh: boolean;
  is_variable_weight: boolean;
  price_per_kg: number | null;
  vat_rate: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  label: string;
  unit: string;
  quantity: number;
  price: number;
  compare_at_price: number | null;
  is_default: boolean;
  created_at: string;
}

export interface Inventory {
  id: string;
  variant_id: string;
  warehouse_id: string;
  stock: number;
  min_stock: number;
  batch_number: string | null;
  expiry_date: string | null;
  updated_at: string;
}

export interface Cart {
  id: string;
  user_id: string;
  updated_at: string;
}

export interface CartItem {
  id: string;
  cart_id: string;
  variant_id: string;
  quantity: number;
  substitution_preference: SubstitutionPreference;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  address_id: string | null;
  warehouse_id: string | null;
  status: OrderStatus;
  delivery_type: DeliveryType;
  scheduled_for: string | null;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  vat: number;
  total: number;
  coupon_code: string | null;
  delivery_otp: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  variant_id: string;
  product_name: string;
  variant_label: string;
  ordered_quantity: number;
  packed_quantity: number | null;
  unit_price: number;
  line_total: number;
  is_substituted: boolean;
  substituted_variant_id: string | null;
  created_at: string;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  status: OrderStatus;
  note: string | null;
  created_at: string;
}

export interface DeliveryPartner {
  id: string;
  vehicle_type: string | null;
  is_available: boolean;
  current_lat: number | null;
  current_lng: number | null;
  rating: number | null;
  created_at: string;
}

export interface DeliveryAssignment {
  id: string;
  order_id: string;
  rider_id: string | null;
  assigned_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  route_sequence: number | null;
  created_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  provider_reference: string | null;
  created_at: string;
}

export interface Promotion {
  id: string;
  code: string | null;
  type: PromotionType;
  value: number | null;
  min_order_amount: number | null;
  category_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  is_active: boolean;
  created_at: string;
}

export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  order_id: string | null;
  rating: number;
  comment: string | null;
  reviewer_name: string | null;
  created_at: string;
}

// Convenience composite types used across the UI.
export interface ProductWithVariants extends Product {
  category: Category | null;
  product_variants: ProductVariant[];
}

export interface CartItemWithVariant extends CartItem {
  product_variants: ProductVariant & { products: Product };
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
}

// Minimal Database type so @supabase/ssr generics compile without codegen.
// Replace with the generated Database type once Supabase CLI codegen is run.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;

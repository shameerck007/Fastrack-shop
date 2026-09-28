import { createClient } from "@/lib/supabase/server";
import type { Order, OrderItem, OrderStatusHistory, ProductWithVariants } from "@/types/database";

export interface OrderDetail extends Order {
  order_items: (OrderItem & {
    product_variants: { products: { image_url: string | null; name: string; name_ar: string | null } | null } | null;
  })[];
  order_status_history: OrderStatusHistory[];
  addresses: {
    address_line: string;
    label: string;
    city: string;
    district: string | null;
    building_number: string | null;
    unit_number: string | null;
    receiver_name: string | null;
    receiver_phone: string | null;
  } | null;
  payments: { method: string }[];
  delivery_assignments: {
    id: string;
    rider_id: string | null;
    delivery_partners: {
      current_lat: number | null;
      current_lng: number | null;
      profiles: { full_name: string | null; phone: string | null };
    } | null;
  } | null;
}

export interface OrderListItem extends Order {
  order_items: {
    id: string;
    product_name: string;
    variant_label: string;
    ordered_quantity: number;
    variant_id: string;
    product_variants: { products: { image_url: string | null; name: string; name_ar: string | null } | null } | null;
  }[];
  addresses: { short_address: string | null; city: string; label: string } | null;
  payments: { method: string }[];
}

export async function getMyOrders(): Promise<OrderListItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // order_items has two FKs to product_variants (variant_id and
  // substituted_variant_id) — disambiguate with !variant_id, same as
  // getBuyAgainProducts.
  const { data, error } = await supabase
    .from("orders")
    .select(
      "*, order_items(id, product_name, variant_label, ordered_quantity, variant_id, product_variants!variant_id(products(image_url, name, name_ar))), addresses(short_address, city, label), payments(method)"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as unknown as OrderListItem[]) ?? [];
}

export async function getBuyAgainProducts(limit = 10): Promise<ProductWithVariants[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: orders } = await supabase.from("orders").select("id").eq("user_id", user.id);
  const orderIds = (orders ?? []).map((o) => o.id);
  if (orderIds.length === 0) return [];

  // order_items has two FKs to product_variants (variant_id and
  // substituted_variant_id), so the embed must be disambiguated with
  // !variant_id or PostgREST rejects it as ambiguous.
  const { data: items, error } = await supabase
    .from("order_items")
    .select(
      "created_at, product_variants!variant_id(id, product_id, products(*, category:categories(*), product_variants(*)))"
    )
    .in("order_id", orderIds)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const seen = new Set<string>();
  const products: ProductWithVariants[] = [];
  for (const item of items ?? []) {
    const variant = item.product_variants as unknown as { products: ProductWithVariants } | null;
    const product = variant?.products;
    if (!product || seen.has(product.id) || !product.is_active) continue;
    seen.add(product.id);
    products.push(product);
    if (products.length >= limit) break;
  }
  return products;
}

export async function getOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "*, order_items(*, product_variants!variant_id(products(image_url, name, name_ar))), order_status_history(*), addresses(address_line, label, city, district, building_number, unit_number, receiver_name, receiver_phone), payments(method), delivery_assignments(id, rider_id, delivery_partners(current_lat, current_lng, profiles(full_name, phone)))"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as OrderDetail | null;
}

export interface InvoiceData extends Order {
  order_items: OrderItem[];
  addresses: {
    address_line: string;
    label: string;
    city: string;
    district: string | null;
    building_number: string | null;
    unit_number: string | null;
    postal_code: string | null;
    short_address: string | null;
    receiver_name: string | null;
    receiver_phone: string | null;
  } | null;
  profiles: { full_name: string | null; phone: string | null } | null;
  payments: { method: string; status: string }[];
}

// Relies on RLS (same policies as getOrderDetail) to scope access: the
// caller only gets a row back if they own the order, are an admin, or are
// the assigned rider — no separate authorization check needed here.
export async function getInvoiceData(orderId: string): Promise<InvoiceData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "*, order_items(*), addresses(address_line, label, city, district, building_number, unit_number, postal_code, short_address, receiver_name, receiver_phone), profiles(full_name, phone), payments(method, status)"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw error;
  return data as InvoiceData | null;
}

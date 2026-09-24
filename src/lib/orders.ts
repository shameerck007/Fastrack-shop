import { createClient } from "@/lib/supabase/server";
import type { Order, OrderItem, OrderStatusHistory, ProductWithVariants } from "@/types/database";

export interface OrderDetail extends Order {
  order_items: OrderItem[];
  order_status_history: OrderStatusHistory[];
  addresses: { address_line: string; label: string } | null;
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

export async function getMyOrders(): Promise<Order[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
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
      "*, order_items(*), order_status_history(*), addresses(address_line, label), delivery_assignments(id, rider_id, delivery_partners(current_lat, current_lng, profiles(full_name, phone)))"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw error;
  return data as OrderDetail | null;
}

export interface InvoiceData extends Order {
  order_items: OrderItem[];
  addresses: { address_line: string; label: string; city: string } | null;
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
      "*, order_items(*), addresses(address_line, label, city), profiles(full_name, phone), payments(method, status)"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw error;
  return data as InvoiceData | null;
}

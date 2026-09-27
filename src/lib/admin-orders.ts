import { createClient } from "@/lib/supabase/server";
import type {
  Order,
  OrderItem,
  OrderStatusHistory,
  PaymentMethod,
  PaymentStatus,
} from "@/types/database";

export interface AdminOrderListRow extends Order {
  profiles: { full_name: string | null; phone: string | null } | null;
  payments: { method: PaymentMethod; status: PaymentStatus }[];
  order_items: { id: string; ordered_quantity: number }[];
  addresses: { city: string; district: string | null } | null;
}

export async function getAdminOrders(limit = 100): Promise<AdminOrderListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "*, profiles(full_name, phone), payments(method, status), order_items(id, ordered_quantity), addresses(city, district)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as unknown as AdminOrderListRow[]) ?? [];
}

export interface AdminOrderItem extends OrderItem {
  image_url: string | null;
  brand: string | null;
  store_name: string | null;
}

export interface AdminOrderDetail extends Order {
  order_items: OrderItem[];
  order_status_history: OrderStatusHistory[];
  profiles: { full_name: string | null; phone: string | null } | null;
  addresses: {
    label: string;
    address_line: string;
    city: string;
    district: string | null;
    building_number: string | null;
    unit_number: string | null;
    postal_code: string | null;
    short_address: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
  payments: { method: PaymentMethod; status: PaymentStatus; amount: number }[];
  delivery_assignments: {
    id: string;
    rider_id: string | null;
    delivery_partners: { profiles: { full_name: string | null; phone: string | null } | null } | null;
  } | null;
  items: AdminOrderItem[];
}

export async function getAdminOrderDetail(orderId: string): Promise<AdminOrderDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "*, order_items(*), order_status_history(*), profiles(full_name, phone), addresses(*), payments(method, status, amount), delivery_assignments(id, rider_id, delivery_partners(profiles(full_name, phone)))"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const order = data as unknown as Omit<AdminOrderDetail, "items">;

  const variantIds = order.order_items.map((i) => i.variant_id);
  const { data: variants } = await supabase
    .from("product_variants")
    .select("id, products(image_url, brand, stores(name))")
    .in("id", variantIds);

  const byVariant = new Map<
    string,
    { image_url: string | null; brand: string | null; store_name: string | null }
  >();
  for (const v of (variants ?? []) as unknown as {
    id: string;
    products: { image_url: string | null; brand: string | null; stores: { name: string } | null } | null;
  }[]) {
    byVariant.set(v.id, {
      image_url: v.products?.image_url ?? null,
      brand: v.products?.brand ?? null,
      store_name: v.products?.stores?.name ?? null,
    });
  }

  const items: AdminOrderItem[] = order.order_items.map((item) => ({
    ...item,
    image_url: byVariant.get(item.variant_id)?.image_url ?? null,
    brand: byVariant.get(item.variant_id)?.brand ?? null,
    store_name: byVariant.get(item.variant_id)?.store_name ?? null,
  }));

  order.order_status_history = [...order.order_status_history].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return { ...order, items };
}

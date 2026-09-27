import { createClient } from "@/lib/supabase/server";
import type {
  Order,
  OrderStatus,
  OrderItem,
  OrderStatusHistory,
  PaymentMethod,
  PaymentStatus,
} from "@/types/database";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface FulfillmentSummary {
  fromFastrack: boolean;
  merchantNames: string[];
}

/** Who actually fulfils a set of order lines — FasTrack's own stock (no
 * store_id) or a named third-party merchant — resolved in one batch query
 * per caller rather than per order/item, shared by every view that needs it. */
async function resolveFulfillment(
  supabase: SupabaseServerClient,
  itemsByOrder: Map<string, { variant_id: string }[]>
): Promise<Map<string, FulfillmentSummary>> {
  const variantIds = [...new Set([...itemsByOrder.values()].flatMap((items) => items.map((i) => i.variant_id)))];
  const storeByVariant = new Map<string, string | null>();
  if (variantIds.length > 0) {
    const { data: variants } = await supabase
      .from("product_variants")
      .select("id, products(store_id, stores(name))")
      .in("id", variantIds);
    for (const v of (variants ?? []) as unknown as {
      id: string;
      products: { store_id: string | null; stores: { name: string } | null } | null;
    }[]) {
      storeByVariant.set(v.id, v.products?.stores?.name ?? null);
    }
  }

  const result = new Map<string, FulfillmentSummary>();
  for (const [orderId, items] of itemsByOrder) {
    const merchantNames = new Set<string>();
    let fromFastrack = false;
    for (const item of items) {
      const storeName = storeByVariant.get(item.variant_id);
      if (storeName) merchantNames.add(storeName);
      else fromFastrack = true;
    }
    result.set(orderId, { fromFastrack, merchantNames: [...merchantNames] });
  }
  return result;
}

export interface AdminOrderListRow extends Order {
  profiles: { full_name: string | null; phone: string | null } | null;
  payments: { method: PaymentMethod; status: PaymentStatus }[];
  order_items: { id: string; ordered_quantity: number }[];
  addresses: { city: string; district: string | null } | null;
  fulfillment: FulfillmentSummary;
}

export async function getAdminOrders(limit = 100): Promise<AdminOrderListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "*, profiles(full_name, phone), payments(method, status), order_items(id, ordered_quantity, variant_id), addresses(city, district)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  const orders = (data as unknown as (AdminOrderListRow & { order_items: { id: string; ordered_quantity: number; variant_id: string }[] })[]) ?? [];

  const fulfillmentByOrder = await resolveFulfillment(
    supabase,
    new Map(orders.map((o) => [o.id, o.order_items]))
  );
  for (const order of orders) {
    order.fulfillment = fulfillmentByOrder.get(order.id) ?? { fromFastrack: true, merchantNames: [] };
  }

  return orders;
}

export interface AdminQueueOrder {
  id: string;
  order_number: string;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  total: number;
  delivery_type: string;
  customer_name: string | null;
  item_count: number;
  fulfillment: FulfillmentSummary;
}

/** Every order still in the active pipeline (not delivered/cancelled),
 * oldest first — the operational queue an ops team works down, Instamart/
 * Amazon-ops-board style. Deliberately not capped by getAdminOrders' recency
 * limit: an order stuck since yesterday still needs to show up here. */
export async function getAdminOrdersQueue(): Promise<AdminQueueOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, created_at, updated_at, total, delivery_type, profiles(full_name), order_items(ordered_quantity, variant_id)"
    )
    .not("status", "in", "(delivered,cancelled)")
    .order("created_at", { ascending: true });

  if (error) throw error;
  const rows = (data ?? []) as unknown as {
    id: string;
    order_number: string;
    status: OrderStatus;
    created_at: string;
    updated_at: string;
    total: number;
    delivery_type: string;
    profiles: { full_name: string | null } | null;
    order_items: { ordered_quantity: number; variant_id: string }[];
  }[];

  const fulfillmentByOrder = await resolveFulfillment(supabase, new Map(rows.map((r) => [r.id, r.order_items])));

  return rows.map((r) => ({
    id: r.id,
    order_number: r.order_number,
    status: r.status,
    created_at: r.created_at,
    updated_at: r.updated_at,
    total: r.total,
    delivery_type: r.delivery_type,
    customer_name: r.profiles?.full_name ?? null,
    item_count: r.order_items.reduce((sum, i) => sum + Number(i.ordered_quantity), 0),
    fulfillment: fulfillmentByOrder.get(r.id) ?? { fromFastrack: true, merchantNames: [] },
  }));
}

export interface AdminOrderKPIs {
  queue: { pending: number; confirmedPreparing: number; readyForPickup: number; outForDelivery: number };
  today: { totalOrders: number; delivered: number; cancelled: number; revenue: number };
}

/** Two different scopes on purpose: the queue counts are status-based and
 * span every open order regardless of age (what needs attention right now),
 * while "today" is a same-day performance summary (what shipped/was lost
 * today) — mirroring how quick-commerce ops dashboards split "now" from
 * "today". */
export async function getAdminOrderKPIs(): Promise<AdminOrderKPIs> {
  const supabase = await createClient();
  const now = new Date();
  const todayStartUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();

  const [
    { count: pending },
    { count: confirmedPreparing },
    { count: readyForPickup },
    { count: outForDelivery },
    { data: todayOrders },
  ] = await Promise.all([
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("orders").select("*", { count: "exact", head: true }).in("status", ["confirmed", "preparing"]),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "ready_for_pickup"),
    supabase.from("orders").select("*", { count: "exact", head: true }).in("status", ["rider_assigned", "out_for_delivery"]),
    supabase.from("orders").select("status, total").gte("created_at", todayStartUTC),
  ]);

  const today = todayOrders ?? [];
  const delivered = today.filter((o) => o.status === "delivered").length;
  const cancelled = today.filter((o) => o.status === "cancelled").length;
  const revenue = today.filter((o) => o.status !== "cancelled").reduce((sum, o) => sum + Number(o.total), 0);

  return {
    queue: {
      pending: pending ?? 0,
      confirmedPreparing: confirmedPreparing ?? 0,
      readyForPickup: readyForPickup ?? 0,
      outForDelivery: outForDelivery ?? 0,
    },
    today: {
      totalOrders: today.length,
      delivered,
      cancelled,
      revenue: Math.round(revenue * 100) / 100,
    },
  };
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
    receiver_name: string | null;
    receiver_phone: string | null;
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

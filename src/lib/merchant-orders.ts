import { createClient } from "@/lib/supabase/server";
import type { Order, OrderStatus } from "@/types/database";

export interface MerchantOrderItem {
  id: string;
  product_name: string;
  variant_label: string;
  ordered_quantity: number;
  line_total: number;
  product_variants: { products: { image_url: string | null; name: string; name_ar: string | null } | null } | null;
}

export interface MerchantOrderRow extends Pick<Order, "id" | "order_number" | "status" | "created_at"> {
  order_items: MerchantOrderItem[];
}

// RLS ("merchants view orders containing their products" / "merchants view
// their order items") does the actual scoping here: a plain select only
// ever returns orders that include at least one of this store's products,
// and within those orders, only the line items that are this store's own —
// a mixed order with another seller's items never exposes those lines or
// their prices to this merchant. No store_id filter needed client-side.
export async function getMerchantOrders(limit = 100): Promise<MerchantOrderRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, created_at, order_items(id, product_name, variant_label, ordered_quantity, line_total, variant_id, product_variants!variant_id(products(image_url, name, name_ar)))"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as unknown as MerchantOrderRow[]) ?? [];
}

export interface MerchantOrderKPIs {
  newCount: number;
  preparingCount: number;
  readyCount: number;
}

const ACTIVE_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready_for_pickup",
  "rider_assigned",
  "out_for_delivery",
];

export function summarizeMerchantOrders(orders: MerchantOrderRow[]): MerchantOrderKPIs {
  return {
    newCount: orders.filter((o) => o.status === "pending" || o.status === "confirmed").length,
    preparingCount: orders.filter((o) => o.status === "preparing").length,
    readyCount: orders.filter((o) => o.status === "ready_for_pickup").length,
  };
}

export { ACTIVE_STATUSES };

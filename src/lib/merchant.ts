import { createClient } from "@/lib/supabase/server";
import type { Store } from "@/types/database";

export async function getMyStore(): Promise<Store | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export interface MerchantProduct {
  id: string;
  name: string;
  brand: string | null;
  sku: string | null;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  category_id: string | null;
  category: { name: string } | null;
  product_variants: {
    id: string;
    label: string;
    unit: string;
    quantity: number;
    price: number;
    compare_at_price: number | null;
    inventory: { id: string; stock: number; min_stock: number }[];
  }[];
}

export async function getMyStoreProducts(storeId: string): Promise<MerchantProduct[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, brand, sku, description, image_url, is_active, category_id, category:categories(name), product_variants(id, label, unit, quantity, price, compare_at_price, inventory(id, stock, min_stock))"
    )
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as unknown as MerchantProduct[]) ?? [];
}

export async function getPendingStores(): Promise<Store[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export interface MerchantOrderItem {
  id: string;
  order_id: string;
  product_name: string;
  variant_label: string;
  ordered_quantity: number;
  unit_price: number;
  line_total: number;
  order: {
    order_number: string;
    status: string;
    created_at: string;
  };
}

export interface MerchantOrder {
  orderId: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  items: MerchantOrderItem[];
  total: number;
}

/** Orders containing this merchant's products — grouped by order, with only
 * this merchant's own line items included (RLS scopes order_items to rows
 * whose product belongs to the caller's store; a co-seller's items in the
 * same order never come back). */
export async function getMyStoreOrders(): Promise<MerchantOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_items")
    .select(
      "id, order_id, product_name, variant_label, ordered_quantity, unit_price, line_total, order:orders(order_number, status, created_at)"
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  const items = (data as unknown as MerchantOrderItem[]) ?? [];

  const byOrder = new Map<string, MerchantOrder>();
  for (const item of items) {
    let group = byOrder.get(item.order_id);
    if (!group) {
      group = {
        orderId: item.order_id,
        orderNumber: item.order.order_number,
        status: item.order.status,
        createdAt: item.order.created_at,
        items: [],
        total: 0,
      };
      byOrder.set(item.order_id, group);
    }
    group.items.push(item);
    group.total += item.line_total;
  }
  return [...byOrder.values()];
}

export async function getAllStores(): Promise<Store[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

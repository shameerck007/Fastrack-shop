import { cache } from "react";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Store } from "@/types/database";

export const getMyStore = cache(async (): Promise<Store | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
});

export interface MerchantProduct {
  id: string;
  name: string;
  name_ar: string | null;
  brand: string | null;
  brand_ar: string | null;
  sku: string | null;
  description: string | null;
  description_ar: string | null;
  tax_rate?: number | null;
  hsn_code?: string | null;
  image_url: string | null;
  is_active: boolean;
  category_id: string | null;
  category: { name: string } | null;
  product_variants: {
    id: string;
    label: string;
    label_ar: string | null;
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
      "id, name, name_ar, brand, brand_ar, sku, description, description_ar, tax_rate, hsn_code, image_url, is_active, category_id, category:categories(name), product_variants(id, label, label_ar, unit, quantity, price, compare_at_price, inventory(id, stock, min_stock))"
    )
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as unknown as MerchantProduct[]) ?? [];
}

/** One page of the supplier's own products, searched on the server so a big range never has to load at once. */
export async function getMyStoreProductsPage(
  storeId: string,
  opts: { q?: string; page?: number; pageSize?: number } = {}
): Promise<{ items: MerchantProduct[]; total: number }> {
  const supabase = await createClient();
  const pageSize = opts.pageSize ?? 24;
  const page = Math.max(1, opts.page ?? 1);
  let q = supabase
    .from("products")
    .select(
      "id, name, name_ar, brand, brand_ar, sku, description, description_ar, tax_rate, hsn_code, image_url, is_active, category_id, category:categories(name), product_variants(id, label, label_ar, unit, quantity, price, compare_at_price, inventory(id, stock, min_stock))",
      { count: "exact" }
    )
    .eq("store_id", storeId);
  const needle = (opts.q ?? "").trim().replace(/[,()*%\\"]/g, " ").replace(/\s+/g, " ").trim();
  if (needle) {
    const like = `%${needle}%`;
    q = q.or(`name.ilike.${like},name_ar.ilike.${like},brand.ilike.${like},sku.ilike.${like}`);
  }
  const from = (page - 1) * pageSize;
  const { data, error, count } = await q.order("created_at", { ascending: false }).range(from, from + pageSize - 1);
  if (error) throw error;
  return { items: (data as unknown as MerchantProduct[]) ?? [], total: count ?? 0 };
}

export interface MerchantStats {
  products: number;
  active: number;
  lowStock: number;
  newOrders: number;
  preparing: number;
  ready: number;
}

/** The dashboard numbers from small count queries (no product lists), all at once. */
export async function getMerchantStats(storeId: string): Promise<MerchantStats> {
  const supabase = await createClient();
  const [all, active, stockRows, openOrders] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId).eq("is_active", true),
    supabase
      .from("inventory")
      .select("stock, min_stock, product_variants!inner(products!inner(store_id))")
      .eq("product_variants.products.store_id", storeId)
      .limit(5000),
    // RLS only returns orders that contain this store's items.
    supabase.from("orders").select("status").in("status", ["pending", "confirmed", "preparing", "ready_for_pickup"]).limit(1000),
  ]);
  const rows = (stockRows.data ?? []) as unknown as { stock: number; min_stock: number }[];
  const orders = (openOrders.data ?? []) as { status: string }[];
  return {
    products: all.count ?? 0,
    active: active.count ?? 0,
    lowStock: rows.filter((r) => r.stock < r.min_stock).length,
    newOrders: orders.filter((o) => o.status === "pending" || o.status === "confirmed").length,
    preparing: orders.filter((o) => o.status === "preparing").length,
    ready: orders.filter((o) => o.status === "ready_for_pickup").length,
  };
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

export async function getAllStores(): Promise<Store[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

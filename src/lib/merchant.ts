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

export async function getAllStores(): Promise<Store[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

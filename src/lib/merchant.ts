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
  is_active: boolean;
  category: { name: string } | null;
  product_variants: {
    id: string;
    label: string;
    price: number;
    inventory: { id: string; stock: number; min_stock: number }[];
  }[];
}

export async function getMyStoreProducts(storeId: string): Promise<MerchantProduct[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, brand, is_active, category:categories(name), product_variants(id, label, price, inventory(id, stock, min_stock))"
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

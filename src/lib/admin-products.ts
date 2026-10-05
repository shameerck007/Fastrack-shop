import { createClient } from "@/lib/supabase/server";

export interface AdminProduct {
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
    inventory: { id: string; stock: number; min_stock: number; warehouse_id: string }[];
  }[];
}

export async function getAdminProducts(): Promise<AdminProduct[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, name_ar, brand, brand_ar, sku, description, description_ar, tax_rate, hsn_code, image_url, is_active, category_id, category:categories(name), product_variants(id, label, label_ar, unit, quantity, price, compare_at_price, inventory(id, stock, min_stock, warehouse_id))"
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as unknown as AdminProduct[]) ?? [];
}

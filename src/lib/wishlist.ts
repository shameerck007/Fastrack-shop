import { createClient } from "@/lib/supabase/server";
import type { ProductWithVariants } from "@/types/database";

export async function getWishlistProducts(): Promise<ProductWithVariants[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("wishlist_items")
    .select("created_at, products(*, category:categories(*), product_variants(*))")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const products: ProductWithVariants[] = [];
  for (const row of data ?? []) {
    const product = row.products as unknown as ProductWithVariants | null;
    if (product && product.is_active) products.push(product);
  }
  return products;
}

export async function isProductWishlisted(productId: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("wishlist_items")
    .select("id")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();

  return !!data;
}

import { createClient } from "@/lib/supabase/server";
import type { Review } from "@/types/database";

export interface ProductRating {
  avg_rating: number;
  review_count: number;
}

export async function getProductRatingsMap(
  productIds: string[]
): Promise<Map<string, ProductRating>> {
  const map = new Map<string, ProductRating>();
  if (productIds.length === 0) return map;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_ratings")
    .select("*")
    .in("product_id", productIds);

  if (error) throw error;
  for (const row of data ?? []) {
    map.set(row.product_id, { avg_rating: Number(row.avg_rating), review_count: row.review_count });
  }
  return map;
}

export async function getProductRating(productId: string): Promise<ProductRating | null> {
  const map = await getProductRatingsMap([productId]);
  return map.get(productId) ?? null;
}

export async function getProductReviews(productId: string): Promise<Review[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

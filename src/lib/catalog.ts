import { createClient } from "@/lib/supabase/server";
import type { Category, ProductWithVariants } from "@/types/database";

export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getFeaturedProducts(limit = 8): Promise<ProductWithVariants[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, category:categories(*), product_variants(*)")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as ProductWithVariants[]) ?? [];
}

export async function getProductsByCategory(slug: string): Promise<{
  category: Category | null;
  products: ProductWithVariants[];
}> {
  const supabase = await createClient();

  const { data: category } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!category) return { category: null, products: [] };

  const { data: products, error } = await supabase
    .from("products")
    .select("*, category:categories(*), product_variants(*)")
    .eq("category_id", category.id)
    .eq("is_active", true);

  if (error) throw error;
  return { category, products: (products as ProductWithVariants[]) ?? [] };
}

export async function getProductById(id: string): Promise<ProductWithVariants | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, category:categories(*), product_variants(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data as ProductWithVariants) ?? null;
}

export async function searchProducts(query: string): Promise<ProductWithVariants[]> {
  const supabase = await createClient();
  // Escape PostgREST filter syntax characters so the raw query can't alter the .or() clause.
  const safe = query.replace(/[%,()]/g, "").trim();
  if (!safe) return [];

  const { data, error } = await supabase
    .from("products")
    .select("*, category:categories(*), product_variants(*)")
    .eq("is_active", true)
    .or(`name.ilike.%${safe}%,name_ar.ilike.%${safe}%,brand.ilike.%${safe}%`);

  if (error) throw error;
  return (data as ProductWithVariants[]) ?? [];
}

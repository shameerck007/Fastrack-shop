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

export async function getFreshTodayProducts(limit = 8): Promise<ProductWithVariants[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, category:categories(*), product_variants(*)")
    .eq("is_active", true)
    .eq("is_fresh", true)
    .limit(limit);

  if (error) throw error;
  return (data as ProductWithVariants[]) ?? [];
}

export async function getOfferProducts(limit = 8): Promise<ProductWithVariants[]> {
  const supabase = await createClient();
  // product_variants.compare_at_price is only set on discounted variants, so an
  // inner join here naturally filters to products that currently have an offer.
  const { data, error } = await supabase
    .from("products")
    .select("*, category:categories(*), product_variants!inner(*)")
    .eq("is_active", true)
    .not("product_variants.compare_at_price", "is", null)
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

export interface PublicStoreProfile {
  id: string;
  name: string;
  city: string;
}

export async function getApprovedStoreById(storeId: string): Promise<PublicStoreProfile | null> {
  const supabase = await createClient();
  // `stores` has no public select policy (it holds cr/vat/bank details), so
  // the storefront looks up only the safe fields via this RPC.
  const { data, error } = await supabase
    .rpc("public_store_profile", { target_store_id: storeId })
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function getStoreProducts(storeId: string): Promise<ProductWithVariants[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, category:categories(*), product_variants(*)")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as ProductWithVariants[]) ?? [];
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

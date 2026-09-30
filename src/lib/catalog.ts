import { createClient } from "@/lib/supabase/server";
import type { Category, ProductWithVariants } from "@/types/database";

// Top-level only — this is what the header nav and the home page's "Shop by
// category" grid show. Subcategories are fetched per-parent (getSubcategories)
// where they're actually shown, mirroring Amazon/Noon's two-level structure.
export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .is("parent_id", null)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getSubcategories(parentId: string): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("parent_id", parentId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export interface CategoryWithChildren extends Category {
  children: Category[];
}

// One query for the whole tree (rather than a per-category subcategory
// fetch) — used wherever the nav needs to show subcategories on hover, like
// Amazon/Noon's category flyout menus.
export async function getCategoriesWithChildren(): Promise<CategoryWithChildren[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").select("*").order("sort_order", { ascending: true });
  if (error) throw error;

  const all = (data ?? []) as Category[];
  const topLevel = all.filter((c) => !c.parent_id);
  const childrenByParent = new Map<string, Category[]>();
  for (const c of all) {
    if (c.parent_id) childrenByParent.set(c.parent_id, [...(childrenByParent.get(c.parent_id) ?? []), c]);
  }
  return topLevel.map((c) => ({ ...c, children: childrenByParent.get(c.id) ?? [] }));
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
  subcategories: Category[];
  parent: Category | null;
  products: ProductWithVariants[];
}> {
  const supabase = await createClient();

  const { data: category } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!category) return { category: null, subcategories: [], parent: null, products: [] };

  const [subcategories, parent] = await Promise.all([
    category.parent_id ? Promise.resolve([]) : getSubcategories(category.id),
    category.parent_id
      ? supabase.from("categories").select("*").eq("id", category.parent_id).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
  ]);

  // Browsing a parent category (e.g. "Grocery") shows products from it and
  // all of its subcategories combined, like Amazon/Noon; a subcategory page
  // shows only its own products.
  const categoryIds = [category.id, ...subcategories.map((c) => c.id)];

  const { data: products, error } = await supabase
    .from("products")
    .select("*, category:categories(*), product_variants(*)")
    .in("category_id", categoryIds)
    .eq("is_active", true);

  if (error) throw error;
  return { category, subcategories, parent, products: (products as ProductWithVariants[]) ?? [] };
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
  return (data as PublicStoreProfile | null) ?? null;
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

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function getOwnApprovedStore(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in.");

  const { data: store, error } = await supabase
    .from("stores")
    .select("id, warehouse_id, status")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!store || store.status !== "approved" || !store.warehouse_id) {
    throw new Error("Your store isn't approved yet.");
  }
  return store as { id: string; warehouse_id: string; status: string };
}

export async function createMerchantProduct(input: {
  categoryId: string;
  name: string;
  brand?: string;
  sku?: string;
  description?: string;
  imageUrl?: string;
  price: number;
  compareAtPrice?: number;
  variantLabel: string;
  unit?: string;
  quantity?: number;
  stock: number;
}) {
  const supabase = await createClient();
  // Deriving store/warehouse server-side from the authenticated user (rather
  // than trusting client-supplied ids) — RLS would reject a mismatched
  // store_id anyway, but this fails with a clear error instead of a raw
  // Postgres policy violation.
  const store = await getOwnApprovedStore(supabase);

  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      category_id: input.categoryId,
      store_id: store.id,
      name: input.name,
      brand: input.brand ?? null,
      sku: input.sku ?? null,
      description: input.description ?? null,
      image_url: input.imageUrl ?? null,
    })
    .select("id")
    .single();
  if (productError) throw productError;

  const { data: variant, error: variantError } = await supabase
    .from("product_variants")
    .insert({
      product_id: product.id,
      label: input.variantLabel,
      unit: input.unit ?? "unit",
      quantity: input.quantity ?? 1,
      price: input.price,
      compare_at_price: input.compareAtPrice ?? null,
      is_default: true,
    })
    .select("id")
    .single();
  if (variantError) throw variantError;

  const { error: inventoryError } = await supabase.from("inventory").insert({
    variant_id: variant.id,
    warehouse_id: store.warehouse_id,
    stock: input.stock,
  });
  if (inventoryError) throw inventoryError;

  revalidatePath("/merchant/products");
}

export async function updateMerchantProduct(
  productId: string,
  variantId: string,
  input: {
    categoryId: string;
    name: string;
    brand?: string;
    sku?: string;
    description?: string;
    imageUrl?: string;
    price: number;
    compareAtPrice?: number;
    variantLabel: string;
    unit?: string;
    quantity?: number;
  }
) {
  const supabase = await createClient();
  const store = await getOwnApprovedStore(supabase);

  // Verify the product actually belongs to this merchant's store before
  // writing — RLS would otherwise just silently affect 0 rows on a
  // mismatch instead of erroring, which is exactly the bug that bit the
  // profiles-role update earlier in this project.
  const { data: product, error: fetchError } = await supabase
    .from("products")
    .select("id, store_id")
    .eq("id", productId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!product || product.store_id !== store.id) {
    throw new Error("You can only edit your own products.");
  }

  const { error: productError } = await supabase
    .from("products")
    .update({
      category_id: input.categoryId,
      name: input.name,
      brand: input.brand ?? null,
      sku: input.sku ?? null,
      description: input.description ?? null,
      image_url: input.imageUrl ?? null,
    })
    .eq("id", productId);
  if (productError) throw productError;

  const { error: variantError } = await supabase
    .from("product_variants")
    .update({
      label: input.variantLabel,
      unit: input.unit ?? "unit",
      quantity: input.quantity ?? 1,
      price: input.price,
      compare_at_price: input.compareAtPrice ?? null,
    })
    .eq("id", variantId);
  if (variantError) throw variantError;

  revalidatePath("/merchant/products");
}

export async function updateMerchantProductStock(inventoryId: string, stock: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("inventory").update({ stock }).eq("id", inventoryId);
  if (error) throw error;
  revalidatePath("/merchant/products");
}

export async function toggleMerchantProductActive(productId: string, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ is_active: isActive })
    .eq("id", productId);
  if (error) throw error;
  revalidatePath("/merchant/products");
}

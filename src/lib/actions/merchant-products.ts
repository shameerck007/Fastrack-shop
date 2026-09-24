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
  price: number;
  variantLabel: string;
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
    })
    .select("id")
    .single();
  if (productError) throw productError;

  const { data: variant, error: variantError } = await supabase
    .from("product_variants")
    .insert({
      product_id: product.id,
      label: input.variantLabel,
      price: input.price,
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

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createProduct(input: {
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
  warehouseId: string;
}) {
  const supabase = await createClient();

  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      category_id: input.categoryId,
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
    warehouse_id: input.warehouseId,
    stock: input.stock,
  });
  if (inventoryError) throw inventoryError;

  revalidatePath("/admin/products");
}

export async function updateProductStock(inventoryId: string, stock: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("inventory").update({ stock }).eq("id", inventoryId);
  if (error) throw error;
  revalidatePath("/admin/products");
}

export async function toggleProductActive(productId: string, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ is_active: isActive })
    .eq("id", productId);
  if (error) throw error;
  revalidatePath("/admin/products");
}

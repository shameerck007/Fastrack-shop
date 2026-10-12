"use server";


import { failure } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createProduct(input: {
  categoryId: string;
  name: string;
  nameAr?: string;
  brand?: string;
  brandAr?: string;
  sku?: string;
  description?: string;
  descriptionAr?: string;
  /** Tax percent for this product (null/undefined = the market's default). */
  taxRate?: number | null;
  hsnCode?: string;
  /** The most one order may hold of this product; null/empty = no limit. */
  maxOrderQty?: number | null;
  imageUrl?: string;
  price: number;
  compareAtPrice?: number;
  compareAtUntil?: string;
  variantLabel: string;
  variantLabelAr?: string;
  unit?: string;
  quantity?: number;
  stock: number;
  warehouseId: string;
}) {
  try {
  const supabase = await createClient();

  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      category_id: input.categoryId,
      name: input.name,
      name_ar: input.nameAr?.trim() || null,
      brand: input.brand ?? null,
      brand_ar: input.brandAr?.trim() || null,
      sku: input.sku ?? null,
      description: input.description ?? null,
      description_ar: input.descriptionAr?.trim() || null,
      image_url: input.imageUrl ?? null,
      tax_rate: input.taxRate ?? null,
      hsn_code: input.hsnCode?.trim() || null,
      max_order_qty: input.maxOrderQty ?? null, // empty = the market's default (set by the database)
    })
    .select("id")
    .single();
  if (productError) throw productError;

  const { data: variant, error: variantError } = await supabase
    .from("product_variants")
    .insert({
      product_id: product.id,
      label: input.variantLabel,
      label_ar: input.variantLabelAr?.trim() || null,
      unit: input.unit ?? "unit",
      quantity: input.quantity ?? 1,
      price: input.price,
      compare_at_price: input.compareAtPrice ?? null,
      compare_at_until: input.compareAtPrice != null ? (input.compareAtUntil ?? null) : null,
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

  } catch (e) {
    return failure(e) as never;
  }
}

export async function updateProduct(
  productId: string,
  variantId: string,
  input: {
    categoryId: string;
    name: string;
    nameAr?: string;
    brand?: string;
    brandAr?: string;
    sku?: string;
    description?: string;
    descriptionAr?: string;
    taxRate?: number | null;
    hsnCode?: string;
    maxOrderQty?: number | null;
    imageUrl?: string;
    price: number;
    compareAtPrice?: number;
    compareAtUntil?: string;
    variantLabel: string;
    variantLabelAr?: string;
    unit?: string;
    quantity?: number;
  }
) {
  try {
  const supabase = await createClient();

  const { error: productError } = await supabase
    .from("products")
    .update({
      category_id: input.categoryId,
      name: input.name,
      name_ar: input.nameAr?.trim() || null,
      brand: input.brand ?? null,
      brand_ar: input.brandAr?.trim() || null,
      sku: input.sku ?? null,
      description: input.description ?? null,
      description_ar: input.descriptionAr?.trim() || null,
      image_url: input.imageUrl ?? null,
      tax_rate: input.taxRate ?? null,
      hsn_code: input.hsnCode?.trim() || null,
      max_order_qty: input.maxOrderQty ?? null, // empty = the market's default (set by the database)
    })
    .eq("id", productId);
  if (productError) throw productError;

  const { error: variantError } = await supabase
    .from("product_variants")
    .update({
      label: input.variantLabel,
      label_ar: input.variantLabelAr?.trim() || null,
      unit: input.unit ?? "unit",
      quantity: input.quantity ?? 1,
      price: input.price,
      compare_at_price: input.compareAtPrice ?? null,
      compare_at_until: input.compareAtPrice != null ? (input.compareAtUntil ?? null) : null,
    })
    .eq("id", variantId);
  if (variantError) throw variantError;

  revalidatePath("/admin/products");

  } catch (e) {
    return failure(e) as never;
  }
}

export async function updateProductStock(inventoryId: string, stock: number) {
  try {
  const supabase = await createClient();
  const { error } = await supabase.from("inventory").update({ stock }).eq("id", inventoryId);
  if (error) throw error;
  revalidatePath("/admin/products");

  } catch (e) {
    return failure(e) as never;
  }
}

export async function toggleProductActive(productId: string, isActive: boolean) {
  try {
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ is_active: isActive })
    .eq("id", productId);
  if (error) throw error;
  revalidatePath("/admin/products");

  } catch (e) {
    return failure(e) as never;
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyAdmins } from "@/lib/push";

async function myApprovedStore() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in.");
  const { data: store } = await supabase.from("stores").select("id, warehouse_id, status, name").eq("owner_id", user.id).maybeSingle();
  if (!store || store.status !== "approved" || !store.warehouse_id) throw new Error("Your store isn't approved yet.");
  return { supabase, store: store as { id: string; warehouse_id: string; status: string; name: string } };
}

export interface OfferInput {
  masterVariantId: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
}

/**
 * Sells a catalog product: creates the supplier's product (linked to the master, with the shared name, photo, category and
 * tax) with their price and stock for the pack sizes they choose. Only price and stock are theirs to set.
 */
export async function addMasterToStore(masterId: string, offers: OfferInput[]): Promise<{ error?: string }> {
  try {
    const { supabase, store } = await myApprovedStore();
    const chosen = offers.filter((o) => o.price > 0);
    if (chosen.length === 0) return { error: "Enter a price for at least one pack size." };

    const loose = supabase as unknown as {
      from: (t: string) => { select: (c: string) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: unknown }> }; maybeSingle: () => Promise<{ data: unknown }> } } };
    };
    const { data: m } = await loose
      .from("master_products")
      .select("id, name, name_ar, brand, brand_ar, description, description_ar, category_id, image_url, barcode, hsn_code, tax_rate, status, master_variants(id, label, label_ar, unit, quantity, is_default)")
      .eq("id", masterId)
      .maybeSingle();
    const master = m as {
      id: string;
      name: string;
      name_ar: string | null;
      brand: string | null;
      brand_ar: string | null;
      description: string | null;
      description_ar: string | null;
      category_id: string | null;
      image_url: string | null;
      barcode: string | null;
      hsn_code: string | null;
      tax_rate: number | null;
      status: string;
      master_variants: { id: string; label: string; label_ar: string | null; unit: string; quantity: number; is_default: boolean }[];
    } | null;
    if (!master || master.status !== "approved") return { error: "This product is not in the catalog." };

    const { data: product, error: pErr } = await supabase
      .from("products")
      .insert({
        category_id: master.category_id,
        store_id: store.id,
        master_id: master.id,
        name: master.name,
        name_ar: master.name_ar,
        brand: master.brand,
        brand_ar: master.brand_ar,
        description: master.description,
        description_ar: master.description_ar,
        image_url: master.image_url,
        barcode: master.barcode,
        tax_rate: master.tax_rate,
        hsn_code: master.hsn_code,
      } as never)
      .select("id")
      .single();
    if (pErr) {
      if (pErr.code === "23505") return { error: "You already sell this product." };
      return { error: pErr.message };
    }

    const byId = new Map(master.master_variants.map((v) => [v.id, v]));
    const defaultId = chosen.find((o) => byId.get(o.masterVariantId)?.is_default)?.masterVariantId ?? chosen[0].masterVariantId;
    for (const o of chosen) {
      const mv = byId.get(o.masterVariantId);
      if (!mv) continue;
      const { data: variant, error: vErr } = await supabase
        .from("product_variants")
        .insert({
          product_id: product.id,
          master_variant_id: mv.id,
          label: mv.label,
          label_ar: mv.label_ar,
          unit: mv.unit,
          quantity: mv.quantity,
          price: o.price,
          compare_at_price: o.compareAtPrice && o.compareAtPrice > o.price ? o.compareAtPrice : null,
          is_default: o.masterVariantId === defaultId,
        } as never)
        .select("id")
        .single();
      if (vErr) return { error: vErr.message };
      const { error: iErr } = await supabase.from("inventory").insert({ variant_id: variant.id, warehouse_id: store.warehouse_id, stock: Math.max(0, o.stock || 0) });
      if (iErr) return { error: iErr.message };
    }
    revalidatePath("/merchant/products");
    revalidatePath("/merchant/catalog");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not add this product." };
  }
}

export interface ProductRequestInput {
  name: string;
  nameAr?: string;
  brand?: string;
  description?: string;
  categoryId?: string | null;
  imageUrl?: string | null;
  barcode?: string;
  variants: { label: string; unit?: string; quantity?: number }[];
}

/** A product that is not in the catalog: sent to FasTrack for review before anyone can sell it. */
export async function requestMasterProduct(input: ProductRequestInput): Promise<{ error?: string }> {
  try {
    const { supabase, store } = await myApprovedStore();
    const name = input.name.trim();
    if (!name) return { error: "Enter the product name." };
    const variants = input.variants.filter((v) => v.label.trim());
    if (variants.length === 0) return { error: "Add at least one pack size, for example 1 L or 500 g." };
    const loose = supabase as unknown as {
      from: (t: string) => {
        insert: (r: object | object[]) => { select: (c: string) => { single: () => Promise<{ data: { id: string } | null; error: { message: string; code?: string } | null }> } } & Promise<{ error: { message: string } | null }>;
      };
    };
    const { data, error } = await loose
      .from("master_products")
      .insert({
        name,
        name_ar: input.nameAr?.trim() || null,
        brand: input.brand?.trim() || null,
        description: input.description?.trim() || null,
        category_id: input.categoryId || null,
        image_url: input.imageUrl || null,
        barcode: input.barcode?.trim() || null,
        status: "pending",
        requested_by_store: store.id,
      })
      .select("id")
      .single();
    if (error || !data) {
      if (error?.code === "23505") return { error: "A product with this barcode is already in the catalog. Search for it and add it to your store." };
      if (error?.code === "42P01") return { error: "The master catalog needs the latest database update (migration 0067)." };
      return { error: error?.message ?? "Could not send the request." };
    }
    const { error: vError } = (await loose.from("master_variants").insert(
      variants.map((v, i) => ({ master_id: data.id, label: v.label.trim(), unit: v.unit?.trim() || "unit", quantity: v.quantity && v.quantity > 0 ? v.quantity : 1, is_default: i === 0, sort_order: i }))
    )) as unknown as { error: { message: string } | null };
    if (vError) return { error: vError.message };
    await notifyAdmins({ title: "New product request", body: `${store.name} asked to add ${name} to the catalog.`, url: "/admin/catalog" });
    revalidatePath("/merchant/catalog");
    revalidatePath("/admin/catalog");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not send the request." };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyUsers } from "@/lib/push";

export interface MasterVariantInput {
  label: string;
  labelAr?: string;
  unit?: string;
  quantity?: number;
  barcode?: string;
  isDefault?: boolean;
}

export interface MasterProductInput {
  name: string;
  nameAr?: string;
  brand?: string;
  brandAr?: string;
  description?: string;
  descriptionAr?: string;
  categoryId?: string | null;
  imageUrl?: string | null;
  barcode?: string;
  hsnCode?: string;
  taxRate?: number | null;
  variants: MasterVariantInput[];
}

type Loose = {
  from: (t: string) => {
    insert: (row: object | object[]) => { select: (c: string) => { single: () => Promise<{ data: { id: string } | null; error: { message: string; code?: string } | null }> } } & Promise<{ error: { message: string; code?: string } | null }>;
    update: (row: object) => { eq: (c: string, v: string) => Promise<{ error: { message: string; code?: string } | null }> } & { in: (c: string, v: string[]) => Promise<{ error: { message: string } | null }> };
    delete: () => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
    select: (c: string) => { eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null }> } };
  };
};

function clean(input: MasterProductInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Enter the product name.");
  const variants = input.variants.filter((v) => v.label.trim());
  if (variants.length === 0) throw new Error("Add at least one pack size, for example 1 L or 500 g.");
  if (input.taxRate != null && !(input.taxRate >= 0 && input.taxRate <= 100)) throw new Error("Tax must be between 0 and 100.");
  return {
    row: {
      name,
      name_ar: input.nameAr?.trim() || null,
      brand: input.brand?.trim() || null,
      brand_ar: input.brandAr?.trim() || null,
      description: input.description?.trim() || null,
      description_ar: input.descriptionAr?.trim() || null,
      category_id: input.categoryId || null,
      image_url: input.imageUrl || null,
      barcode: input.barcode?.trim() || null,
      hsn_code: input.hsnCode?.trim() || null,
      tax_rate: input.taxRate ?? null,
      updated_at: new Date().toISOString(),
    },
    variants,
  };
}

function variantRows(masterId: string, variants: MasterVariantInput[]) {
  const hasDefault = variants.some((v) => v.isDefault);
  return variants.map((v, i) => ({
    master_id: masterId,
    label: v.label.trim(),
    label_ar: v.labelAr?.trim() || null,
    unit: v.unit?.trim() || "unit",
    quantity: v.quantity && v.quantity > 0 ? v.quantity : 1,
    barcode: v.barcode?.trim() || null,
    is_default: hasDefault ? !!v.isDefault : i === 0,
    sort_order: i,
  }));
}

function friendly(error: { message: string; code?: string }): string {
  if (error.code === "23505") return "A product with this barcode is already in the catalog.";
  if (error.code === "42P01") return "The master catalog needs the latest database update (migration 0067). Run it, then try again.";
  return error.message;
}

export async function createMasterProduct(input: MasterProductInput): Promise<{ error?: string; id?: string }> {
  try {
    const { row, variants } = clean(input);
    const supabase = (await createClient()) as unknown as Loose;
    const {
      data: { user },
    } = await (await createClient()).auth.getUser();
    const { data, error } = await supabase.from("master_products").insert({ ...row, status: "approved", created_by: user?.id ?? null }).select("id").single();
    if (error || !data) return { error: friendly(error ?? { message: "Could not save the product." }) };
    const { error: vError } = await supabase.from("master_variants").insert(variantRows(data.id, variants)) as unknown as { error: { message: string } | null };
    if (vError) return { error: vError.message };
    revalidatePath("/admin/catalog");
    return { id: data.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the product." };
  }
}

/** Edits a master product. The shared details are pushed to every supplier's linked product so they never drift apart. */
export async function updateMasterProduct(id: string, input: MasterProductInput): Promise<{ error?: string }> {
  try {
    const { row, variants } = clean(input);
    const supabase = (await createClient()) as unknown as Loose;
    const { error } = await supabase.from("master_products").update(row).eq("id", id);
    if (error) return { error: friendly(error) };

    // Pack sizes: keep existing ones (matched by label) so suppliers' prices stay, add new ones, never delete a size that is sold.
    const real = await createClient();
    const { data: existing } = await (real as unknown as { from: (t: string) => { select: (c: string) => { eq: (c: string, v: string) => Promise<{ data: { id: string; label: string }[] | null }> } } })
      .from("master_variants")
      .select("id, label")
      .eq("master_id", id);
    const have = new Map((existing ?? []).map((v) => [v.label.trim().toLowerCase(), v.id]));
    for (const [i, v] of variantRows(id, variants).entries()) {
      const key = v.label.toLowerCase();
      if (have.has(key)) {
        await supabase.from("master_variants").update({ label_ar: v.label_ar, unit: v.unit, quantity: v.quantity, barcode: v.barcode, is_default: v.is_default, sort_order: i }).eq("id", have.get(key) as string);
      } else {
        await supabase.from("master_variants").insert(v);
      }
    }

    // Push the shared details to linked products.
    await supabase
      .from("products")
      .update({
        name: row.name,
        name_ar: row.name_ar,
        brand: row.brand,
        brand_ar: row.brand_ar,
        description: row.description,
        description_ar: row.description_ar,
        category_id: row.category_id,
        image_url: row.image_url,
        tax_rate: row.tax_rate,
        hsn_code: row.hsn_code,
      })
      .eq("master_id", id);

    revalidatePath("/admin/catalog");
    revalidatePath("/merchant/catalog");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the product." };
  }
}

async function ownerOfRequest(masterId: string): Promise<{ ownerId: string | null; name: string }> {
  const supabase = await createClient();
  const { data: m } = await (supabase as unknown as { from: (t: string) => { select: (c: string) => { eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: { name: string; requested_by_store: string | null } | null }> } } } })
    .from("master_products")
    .select("name, requested_by_store")
    .eq("id", masterId)
    .maybeSingle();
  if (!m?.requested_by_store) return { ownerId: null, name: m?.name ?? "Your product" };
  const { data: s } = await supabase.from("stores").select("owner_id").eq("id", m.requested_by_store).maybeSingle();
  return { ownerId: s?.owner_id ?? null, name: m.name };
}

/** Approves a supplier's request: it joins the catalog and the supplier is told they can add it. */
export async function approveMasterProduct(id: string): Promise<{ error?: string }> {
  const supabase = (await createClient()) as unknown as Loose;
  const { error } = await supabase.from("master_products").update({ status: "approved", rejection_reason: null, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: friendly(error) };
  const { ownerId, name } = await ownerOfRequest(id);
  if (ownerId) await notifyUsers([ownerId], { title: "Product approved", body: `${name} is now in the catalog. Add it to your store.`, url: "/merchant/catalog" });
  revalidatePath("/admin/catalog");
  revalidatePath("/merchant/catalog");
  return {};
}

export async function rejectMasterProduct(id: string, reason: string): Promise<{ error?: string }> {
  if (!reason.trim()) return { error: "Say why, so the supplier can fix the request." };
  const supabase = (await createClient()) as unknown as Loose;
  const { error } = await supabase.from("master_products").update({ status: "rejected", rejection_reason: reason.trim(), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: friendly(error) };
  const { ownerId, name } = await ownerOfRequest(id);
  if (ownerId) await notifyUsers([ownerId], { title: "Product request declined", body: `${name}: ${reason.trim()}`, url: "/merchant/catalog" });
  revalidatePath("/admin/catalog");
  revalidatePath("/merchant/catalog");
  return {};
}

/**
 * Starts the catalog from what is already on sale: groups existing products (same barcode, else same name and brand),
 * makes one master product per group (FasTrack's own product first), and links every product and pack size to it.
 * Safe to run again: products that are already linked are skipped.
 */
export async function buildCatalogFromProducts(): Promise<{ error?: string; created?: number; linked?: number }> {
  try {
    const real = await createClient();
    const loose = real as unknown as {
      from: (t: string) => {
        select: (c: string) => { is: (c: string, v: null) => { limit: (n: number) => Promise<{ data: unknown; error: { message: string; code?: string } | null }> } };
      };
    };
    const { data, error } = await loose
      .from("products")
      .select("id, store_id, name, name_ar, brand, brand_ar, description, description_ar, category_id, image_url, barcode, hsn_code, tax_rate, product_variants(id, label, label_ar, unit, quantity)")
      .is("master_id", null)
      .limit(5000);
    if (error) return { error: friendly(error) };
    type P = {
      id: string;
      store_id: string | null;
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
      product_variants: { id: string; label: string; label_ar: string | null; unit: string; quantity: number }[];
    };
    const products = (data ?? []) as unknown as P[];
    const norm = (s: string | null) => (s ?? "").toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, " ").trim();
    const groups = new Map<string, P[]>();
    for (const p of products) {
      const key = p.barcode?.trim() ? `bc:${p.barcode.trim()}` : `nm:${norm(p.name)}|${norm(p.brand)}`;
      groups.set(key, [...(groups.get(key) ?? []), p]);
    }

    const supabase = (await createClient()) as unknown as Loose;
    const {
      data: { user },
    } = await real.auth.getUser();
    let created = 0;
    let linked = 0;
    for (const members of groups.values()) {
      const lead = members.find((m) => m.store_id == null) ?? members.find((m) => m.image_url) ?? members[0];
      const { data: m, error: mErr } = await supabase
        .from("master_products")
        .insert({
          name: lead.name,
          name_ar: lead.name_ar,
          brand: lead.brand,
          brand_ar: lead.brand_ar,
          description: lead.description,
          description_ar: lead.description_ar,
          category_id: lead.category_id,
          image_url: lead.image_url ?? members.find((x) => x.image_url)?.image_url ?? null,
          barcode: lead.barcode?.trim() || null,
          hsn_code: lead.hsn_code,
          tax_rate: lead.tax_rate,
          status: "approved",
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (mErr || !m) continue; // e.g. a duplicate barcode: leave those products unlinked
      created++;
      // One master pack size per distinct label.
      const byLabel = new Map<string, { label: string; label_ar: string | null; unit: string; quantity: number }>();
      for (const mem of members) for (const v of mem.product_variants ?? []) if (!byLabel.has(v.label.trim().toLowerCase())) byLabel.set(v.label.trim().toLowerCase(), v);
      const rows = [...byLabel.values()].map((v, i) => ({ master_id: m.id, label: v.label, label_ar: v.label_ar, unit: v.unit, quantity: v.quantity, is_default: i === 0, sort_order: i }));
      const { data: mvs } = await (real as unknown as { from: (t: string) => { insert: (r: object[]) => { select: (c: string) => Promise<{ data: { id: string; label: string }[] | null }> } } }).from("master_variants").insert(rows).select("id, label");
      const mvByLabel = new Map((mvs ?? []).map((v) => [v.label.trim().toLowerCase(), v.id]));
      await supabase.from("products").update({ master_id: m.id }).in("id", members.map((x) => x.id));
      linked += members.length;
      for (const mem of members) {
        for (const v of mem.product_variants ?? []) {
          const mv = mvByLabel.get(v.label.trim().toLowerCase());
          if (mv) await supabase.from("product_variants").update({ master_variant_id: mv }).eq("id", v.id);
        }
      }
    }
    revalidatePath("/admin/catalog");
    return { created, linked };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not build the catalog." };
  }
}

export interface FastrackOfferInput {
  masterVariantId: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
}

/**
 * FasTrack sells a catalog product itself: creates FasTrack's own product (no supplier), linked to the catalog entry, with
 * the price and the opening stock in the chosen FasTrack location (the other FasTrack locations start at 0, as new ones do).
 */
export async function addMasterToFastrack(masterId: string, warehouseId: string, offers: FastrackOfferInput[]): Promise<{ error?: string }> {
  try {
    const chosen = offers.filter((o) => o.price > 0);
    if (chosen.length === 0) return { error: "Enter a price for at least one pack size." };
    if (!warehouseId) return { error: "Choose the FasTrack location that holds the stock." };
    const supabase = await createClient();
    const loose = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => { eq: (c: string, v: string) => { is: (c: string, v: null) => { limit: (n: number) => Promise<{ data: unknown[] | null }> }; maybeSingle: () => Promise<{ data: unknown }> } };
      };
    };
    const { data: already } = await loose.from("products").select("id").eq("master_id", masterId).is("store_id", null).limit(1);
    if ((already ?? []).length > 0) return { error: "FasTrack already sells this product." };
    const { data: m } = await loose
      .from("master_products")
      .select("id, name, name_ar, brand, brand_ar, description, description_ar, category_id, image_url, barcode, hsn_code, tax_rate, status, master_variants(id, label, label_ar, unit, quantity, is_default)")
      .eq("id", masterId)
      .maybeSingle();
    const master = m as {
      id: string; name: string; name_ar: string | null; brand: string | null; brand_ar: string | null; description: string | null; description_ar: string | null;
      category_id: string | null; image_url: string | null; barcode: string | null; hsn_code: string | null; tax_rate: number | null; status: string;
      master_variants: { id: string; label: string; label_ar: string | null; unit: string; quantity: number; is_default: boolean }[];
    } | null;
    if (!master || master.status !== "approved") return { error: "This product is not in the catalog." };

    const { data: product, error: pErr } = await supabase
      .from("products")
      .insert({
        category_id: master.category_id, master_id: master.id, name: master.name, name_ar: master.name_ar, brand: master.brand, brand_ar: master.brand_ar,
        description: master.description, description_ar: master.description_ar, image_url: master.image_url, barcode: master.barcode, tax_rate: master.tax_rate, hsn_code: master.hsn_code,
      } as never)
      .select("id")
      .single();
    if (pErr) return { error: pErr.message };

    // FasTrack's own locations = warehouses no supplier owns.
    const { data: stores } = await supabase.from("stores").select("warehouse_id");
    const supplierWarehouses = new Set((stores ?? []).map((x) => x.warehouse_id).filter(Boolean));
    const { data: whs } = await supabase.from("warehouses").select("id").eq("is_active", true);
    const ownWarehouseIds = (whs ?? []).map((w) => w.id).filter((id) => !supplierWarehouses.has(id));
    if (!ownWarehouseIds.includes(warehouseId)) ownWarehouseIds.push(warehouseId);

    const byId = new Map(master.master_variants.map((v) => [v.id, v]));
    const defaultId = chosen.find((o) => byId.get(o.masterVariantId)?.is_default)?.masterVariantId ?? chosen[0].masterVariantId;
    for (const o of chosen) {
      const mv = byId.get(o.masterVariantId);
      if (!mv) continue;
      const { data: variant, error: vErr } = await supabase
        .from("product_variants")
        .insert({
          product_id: product.id, master_variant_id: mv.id, label: mv.label, label_ar: mv.label_ar, unit: mv.unit, quantity: mv.quantity,
          price: o.price, compare_at_price: o.compareAtPrice && o.compareAtPrice > o.price ? o.compareAtPrice : null, is_default: o.masterVariantId === defaultId,
        } as never)
        .select("id")
        .single();
      if (vErr) return { error: vErr.message };
      const { error: iErr } = await supabase
        .from("inventory")
        .insert(ownWarehouseIds.map((wid) => ({ variant_id: variant.id, warehouse_id: wid, stock: wid === warehouseId ? Math.max(0, o.stock || 0) : 0 })));
      if (iErr) return { error: iErr.message };
    }
    revalidatePath("/admin/products");
    revalidatePath("/admin/catalog");
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not add this product." };
  }
}

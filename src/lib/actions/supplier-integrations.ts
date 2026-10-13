"use server";

import { revalidatePath } from "next/cache";
import { UserError, failure } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { newApiKey, sha256Hex, KEY_PREFIX } from "@/lib/supplier-api-auth";
import { validateWebhookUrl, newWebhookSecret, sendTestMessage } from "@/lib/webhooks";
import { searchMasterCatalog, getStoreMasterIds } from "@/lib/master-catalog";
import { syncProducts, MAX_ROWS_PER_CALL, type SyncResult, type SyncRow } from "@/lib/supplier-sync";

async function myApprovedStore() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("You must be logged in.");
  const { data: store } = await supabase.from("stores").select("id, tenant_id, warehouse_id, status").eq("owner_id", user.id).maybeSingle();
  if (!store || store.status !== "approved" || !store.warehouse_id) throw new UserError("Your store isn't approved yet.");
  return { supabase, user, store: store as { id: string; tenant_id: string; warehouse_id: string } };
}

/** Creates a key and returns it ONCE; only its hash is kept. */
export async function createApiKey(name: string): Promise<{ key: string }> {
  try {
    const { supabase, user, store } = await myApprovedStore();
    const label = name.trim().slice(0, 60);
    if (!label) throw new UserError("Give the key a name, for example the system that will use it.");
    const { count } = await supabase.from("supplier_api_keys" as never).select("id", { count: "exact", head: true }).eq("store_id", store.id).is("revoked_at", null);
    if ((count ?? 0) >= 5) throw new UserError("You can have 5 active keys. Revoke one you no longer use.");
    const key = newApiKey();
    const { error } = await supabase.from("supplier_api_keys" as never).insert({
      tenant_id: store.tenant_id,
      store_id: store.id,
      name: label,
      key_prefix: key.slice(0, KEY_PREFIX.length + 6),
      key_hash: await sha256Hex(key),
      created_by: user.id,
    } as never);
    if (error) throw error;
    revalidatePath("/merchant/integrations");
    return { key };
  } catch (e) {
    return failure(e) as never;
  }
}

export async function revokeApiKey(id: string) {
  try {
    const { supabase, store } = await myApprovedStore();
    const { error } = await supabase.from("supplier_api_keys" as never).update({ revoked_at: new Date().toISOString() } as never).eq("id", id).eq("store_id", store.id);
    if (error) throw error;
    revalidatePath("/merchant/integrations");
  } catch (e) {
    return failure(e) as never;
  }
}

/** One batch of the CSV upload (the page sends the file in batches so each call stays small). */
export async function importProductRows(rows: SyncRow[], createMissing: boolean): Promise<SyncResult[]> {
  try {
    const { store } = await myApprovedStore();
    if (rows.length > MAX_ROWS_PER_CALL) throw new UserError(`At most ${MAX_ROWS_PER_CALL} rows at a time.`);
    const results = await syncProducts(store, rows, { createMissing });
    revalidatePath("/merchant/products");
    return results;
  } catch (e) {
    return failure(e) as never;
  }
}

/** Saves the webhook address (and switches it on or off). The signing secret is made the first time. */
export async function saveWebhook(url: string, enabled: boolean): Promise<{ secret: string }> {
  try {
    const { supabase, store } = await myApprovedStore();
    const check = validateWebhookUrl(url);
    if (!check.ok) throw new UserError(check.error);
    const { data: existing } = await supabase.from("supplier_webhooks" as never).select("secret").eq("store_id", store.id).maybeSingle();
    const secret = (existing as { secret: string } | null)?.secret ?? newWebhookSecret();
    const { error } = await supabase.from("supplier_webhooks" as never).upsert(
      { store_id: store.id, tenant_id: store.tenant_id, url: check.url, secret, enabled, updated_at: new Date().toISOString() } as never,
      { onConflict: "store_id" }
    );
    if (error) throw error;
    revalidatePath("/merchant/integrations");
    return { secret };
  } catch (e) {
    return failure(e) as never;
  }
}

/** A new secret. The old one stops working at once, so the supplier must update their system. */
export async function regenerateWebhookSecret(): Promise<{ secret: string }> {
  try {
    const { supabase, store } = await myApprovedStore();
    const secret = newWebhookSecret();
    const { data, error } = await supabase.from("supplier_webhooks" as never).update({ secret, updated_at: new Date().toISOString() } as never).eq("store_id", store.id).select("store_id");
    if (error) throw error;
    if (!data || (data as unknown[]).length === 0) throw new UserError("Save a webhook address first.");
    revalidatePath("/merchant/integrations");
    return { secret };
  } catch (e) {
    return failure(e) as never;
  }
}

/** Sends a sample message right now and reports what the supplier's system answered. */
export async function sendTestWebhook(): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const { supabase, store } = await myApprovedStore();
    const { data } = await supabase.from("supplier_webhooks" as never).select("url, secret").eq("store_id", store.id).maybeSingle();
    const w = data as { url: string; secret: string } | null;
    if (!w) throw new UserError("Save a webhook address first.");
    const check = validateWebhookUrl(w.url);
    if (!check.ok) throw new UserError(check.error);
    return await sendTestMessage(check.url, w.secret);
  } catch (e) {
    return failure(e) as never;
  }
}

export interface MyProductRow {
  sku: string | null;
  barcode: string | null;
  name: string;
  name_ar: string | null;
  brand: string | null;
  category: string | null;
  description: string | null;
  image_url: string | null;
  tax_rate: number | null;
  active: string;
  variant_label: string;
  unit: string;
  quantity: number;
  price: number;
  compare_at_price: number | null;
  compare_at_until: string | null;
  stock: number;
}

/** The supplier's own products and packs, one row per pack, in the upload format. Products with neither a sku nor a barcode cannot be matched on upload, so they are counted, not listed. */
export async function exportMyProducts(): Promise<{ rows: MyProductRow[]; skipped: number; truncated: boolean }> {
  try {
    const { supabase, store } = await myApprovedStore();
    const { data, error } = await supabase
      .from("products")
      .select("sku, barcode, master_id, name, name_ar, brand, description, image_url, tax_rate, is_active, category:categories(slug), product_variants(label, unit, quantity, price, compare_at_price, compare_at_until, inventory(stock, warehouse_id))")
      .eq("store_id", store.id)
      .order("name")
      .limit(3000);
    if (error) throw error;
    const rows: MyProductRow[] = [];
    let skipped = 0;
    const prefix = store.id.replace(/-/g, "").slice(0, 6) + "-";
    for (const p of (data ?? []) as unknown as {
      sku: string | null; barcode: string | null; name: string; name_ar: string | null; brand: string | null; description: string | null; image_url: string | null; tax_rate: number | null; is_active: boolean;
      category: { slug: string } | null;
      product_variants: { label: string; unit: string; quantity: number; price: number; compare_at_price: number | null; compare_at_until: string | null; inventory: { stock: number; warehouse_id: string }[] }[];
    }[]) {
      const sku = p.sku ? (p.sku.startsWith(prefix) ? p.sku.slice(prefix.length) : p.sku) : null;
      if (!sku && !p.barcode) {
        skipped++;
        continue;
      }
      for (const v of p.product_variants ?? []) {
        rows.push({
          sku,
          barcode: p.barcode,
          name: p.name,
          name_ar: p.name_ar,
          brand: p.brand,
          category: p.category?.slug ?? null,
          description: p.description,
          image_url: p.image_url,
          tax_rate: p.tax_rate == null ? null : Number(p.tax_rate),
          active: p.is_active ? "yes" : "no",
          variant_label: v.label,
          unit: v.unit,
          quantity: Number(v.quantity),
          price: Number(v.price),
          compare_at_price: v.compare_at_price == null ? null : Number(v.compare_at_price),
          compare_at_until: v.compare_at_until ? v.compare_at_until.slice(0, 10) : null,
          stock: Number((v.inventory ?? []).find((x) => x.warehouse_id === store.warehouse_id)?.stock ?? 0),
        });
      }
    }
    return { rows, skipped, truncated: (data ?? []).length >= 3000 };
  } catch (e) {
    return failure(e) as never;
  }
}

export interface CatalogPick {
  id: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  categoryName: string | null;
  sold: boolean;
  packs: { label: string; unit: string; quantity: number; barcode: string | null }[];
}

/** One page of catalog search results for the "start from the catalog" panel. */
export async function findCatalogForTemplate(q: string, categoryId: string, page: number): Promise<{ items: CatalogPick[]; total: number }> {
  try {
    const { store } = await myApprovedStore();
    const res = await searchMasterCatalog({ status: "approved", q: q.trim() || undefined, categoryId: categoryId || undefined, page: Math.max(1, page), pageSize: 30 });
    if (!res || res.error) throw new UserError("The catalog is not available right now.");
    const sold = await getStoreMasterIds(store.id);
    return {
      total: res.total,
      items: res.items.map((m) => ({
        id: m.id,
        name: m.name,
        brand: m.brand,
        imageUrl: m.imageUrl,
        categoryName: m.categoryName,
        sold: sold.has(m.id),
        packs: m.variants.map((v) => ({ label: v.label, unit: v.unit, quantity: v.quantity, barcode: v.barcode ?? m.barcode })),
      })),
    };
  } catch (e) {
    return failure(e) as never;
  }
}

import { createServiceClient } from "@/lib/supabase/service";

/**
 * One engine behind both the supplier API and the CSV upload: create or update a supplier's products, prices and stock.
 * Always runs with the service role, so every query is scoped to the one store passed in; that store comes from the API key
 * or the signed-in supplier, never from the request body.
 */

export interface SyncStore {
  id: string;
  tenant_id: string;
  warehouse_id: string;
}

/** One pack of one product. Rows are matched to a product by sku and to a pack by variant_label. */
export interface SyncRow {
  sku?: unknown;
  name?: unknown;
  name_ar?: unknown;
  brand?: unknown;
  category?: unknown;
  description?: unknown;
  image_url?: unknown;
  tax_rate?: unknown;
  active?: unknown;
  variant_label?: unknown;
  unit?: unknown;
  quantity?: unknown;
  price?: unknown;
  compare_at_price?: unknown;
  compare_at_until?: unknown;
  stock?: unknown;
}

export interface SyncResult {
  index: number;
  sku: string;
  status: "created" | "updated" | "unchanged" | "error";
  error?: string;
}

export const MAX_ROWS_PER_CALL = 100;

// products.sku is unique across the whole marketplace, so a supplier's own sku is stored with a short store prefix.
// Products added by hand in the portal keep their plain sku, so lookups try both.
const skuPrefix = (storeId: string) => storeId.replace(/-/g, "").slice(0, 6);
const storedSku = (storeId: string, sku: string) => `${skuPrefix(storeId)}-${sku}`;
export const publicSku = (storeId: string, sku: string | null) =>
  sku && sku.startsWith(`${skuPrefix(storeId)}-`) ? sku.slice(skuPrefix(storeId).length + 1) : sku;

const text = (v: unknown, max: number): string | null => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s.slice(0, max);
};
const num = (v: unknown): number | null | "bad" => {
  if (v === undefined || v === null || String(v).trim() === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : "bad";
};
const bool = (v: unknown): boolean | null => {
  if (v === undefined || v === null || String(v).trim() === "") return null;
  return ["1", "true", "yes", "y", "active"].includes(String(v).trim().toLowerCase());
};

interface Clean {
  sku: string;
  name: string | null;
  nameAr: string | null;
  brand: string | null;
  category: string | null;
  description: string | null;
  imageUrl: string | null;
  taxRate: number | null;
  active: boolean | null;
  label: string | null;
  unit: string | null;
  quantity: number | null;
  price: number | null;
  compareAt: number | null;
  compareAtUntil: string | null;
  stock: number | null;
}

function clean(r: SyncRow): Clean | string {
  const sku = text(r.sku, 64);
  if (!sku) return "sku is required";
  const price = num(r.price);
  const compareAt = num(r.compare_at_price);
  const stock = num(r.stock);
  const tax = num(r.tax_rate);
  const qty = num(r.quantity);
  if (price === "bad" || (price !== null && price <= 0)) return "price must be a number above 0";
  if (compareAt === "bad" || (compareAt !== null && compareAt <= 0)) return "compare_at_price must be a number above 0";
  if (price !== null && compareAt !== null && compareAt <= price) return "compare_at_price must be higher than price (it is the old price)";
  if (stock === "bad" || (stock !== null && stock < 0)) return "stock must be a number, 0 or more";
  if (tax === "bad" || (tax !== null && (tax < 0 || tax > 100))) return "tax_rate must be between 0 and 100";
  if (qty === "bad" || (qty !== null && qty <= 0)) return "quantity must be a number above 0";
  const img = text(r.image_url, 500);
  if (img && !/^https:\/\//i.test(img)) return "image_url must be an https link";
  let until: string | null = null;
  const u = text(r.compare_at_until, 40);
  if (u) {
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(u) ? `${u}T23:59:59` : u);
    if (Number.isNaN(d.getTime())) return "compare_at_until must be a date like 2026-12-31";
    until = d.toISOString();
  }
  return {
    sku,
    name: text(r.name, 200),
    nameAr: text(r.name_ar, 200),
    brand: text(r.brand, 100),
    category: text(r.category, 100),
    description: text(r.description, 2000),
    imageUrl: img,
    taxRate: tax as number | null,
    active: bool(r.active),
    label: text(r.variant_label, 60),
    unit: text(r.unit, 20),
    quantity: qty as number | null,
    price: price as number | null,
    compareAt: compareAt as number | null,
    compareAtUntil: until,
    stock: stock as number | null,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function syncProducts(store: SyncStore, rows: SyncRow[], opts: { createMissing: boolean }): Promise<SyncResult[]> {
  const db: any = createServiceClient();
  const results: SyncResult[] = [];
  if (rows.length > MAX_ROWS_PER_CALL) throw new Error(`Send at most ${MAX_ROWS_PER_CALL} rows per call.`);

  // Categories of this market, by slug or name.
  const { data: cats } = await db.from("categories").select("id, name, name_ar, slug").eq("tenant_id", store.tenant_id);
  const catByKey = new Map<string, string>();
  for (const c of (cats ?? []) as { id: string; name: string; name_ar: string | null; slug: string }[]) {
    for (const k of [c.slug, c.name, c.name_ar]) if (k) catByKey.set(k.trim().toLowerCase(), c.id);
  }

  const cleaned = rows.map((r) => clean(r));
  const skus = [...new Set(cleaned.filter((c): c is Clean => typeof c !== "string").map((c) => c.sku))];
  const lookup = skus.flatMap((s) => [s, storedSku(store.id, s)]);
  const { data: existing } = lookup.length
    ? await db
        .from("products")
        .select("id, sku, master_id, product_variants(id, label, is_default, price, compare_at_price, compare_at_until, inventory(id, stock, warehouse_id))")
        .eq("store_id", store.id)
        .in("sku", lookup)
    : { data: [] };
  const bySku = new Map<string, any>();
  for (const p of (existing ?? []) as any[]) bySku.set(publicSku(store.id, p.sku) as string, p);

  for (let i = 0; i < rows.length; i++) {
    const c = cleaned[i];
    const rawSku = text(rows[i].sku, 64) ?? "";
    if (typeof c === "string") {
      results.push({ index: i, sku: rawSku, status: "error", error: c });
      continue;
    }
    try {
      let product = bySku.get(c.sku);
      let touched = false;
      let created = false;

      if (!product) {
        if (!opts.createMissing) throw new Error("No product with this sku. Create it first, or use the products endpoint.");
        if (!c.name) throw new Error("name is required for a new product");
        if (!c.category) throw new Error("category is required for a new product");
        const categoryId = catByKey.get(c.category.toLowerCase());
        if (!categoryId) throw new Error(`category "${c.category}" was not found; use a category name or slug from the shop`);
        if (c.price === null) throw new Error("price is required for a new product");
        if (c.stock === null) throw new Error("stock is required for a new product");
        const { data: p, error: pe } = await db
          .from("products")
          .insert({
            tenant_id: store.tenant_id,
            store_id: store.id,
            category_id: categoryId,
            sku: storedSku(store.id, c.sku),
            name: c.name,
            name_ar: c.nameAr,
            brand: c.brand,
            description: c.description,
            image_url: c.imageUrl,
            tax_rate: c.taxRate,
            is_active: c.active ?? true,
          })
          .select("id, sku, master_id")
          .single();
        if (pe) throw pe;
        product = { ...p, product_variants: [] };
        bySku.set(c.sku, product);
        created = true;
      } else if (!product.master_id) {
        // Shared catalog products keep their shared details; only price and stock are the supplier's to change.
        const patch: Record<string, unknown> = {};
        if (c.name) patch.name = c.name;
        if (c.nameAr) patch.name_ar = c.nameAr;
        if (c.brand) patch.brand = c.brand;
        if (c.description) patch.description = c.description;
        if (c.imageUrl) patch.image_url = c.imageUrl;
        if (c.taxRate !== null) patch.tax_rate = c.taxRate;
        if (c.category) {
          const categoryId = catByKey.get(c.category.toLowerCase());
          if (!categoryId) throw new Error(`category "${c.category}" was not found`);
          patch.category_id = categoryId;
        }
        if (Object.keys(patch).length) {
          const { error } = await db.from("products").update(patch).eq("id", product.id).eq("store_id", store.id);
          if (error) throw error;
          touched = true;
        }
      }
      if (!created && c.active !== null) {
        const { error } = await db.from("products").update({ is_active: c.active }).eq("id", product.id).eq("store_id", store.id);
        if (error) throw error;
        touched = true;
      }

      const variants: any[] = product.product_variants ?? [];
      const wanted = c.label?.toLowerCase();
      const variant = wanted
        ? variants.find((v) => String(v.label).toLowerCase() === wanted)
        : variants.length === 1
          ? variants[0]
          : variants.find((v) => v.is_default);

      if (!variant) {
        if (!created && !opts.createMissing) throw new Error(`No pack "${c.label ?? ""}" on this product.`);
        if (c.price === null) throw new Error("price is required for a new pack");
        if (c.stock === null) throw new Error("stock is required for a new pack");
        const { data: v, error: ve } = await db
          .from("product_variants")
          .insert({
            tenant_id: store.tenant_id,
            product_id: product.id,
            label: c.label ?? "1 unit",
            unit: c.unit ?? "unit",
            quantity: c.quantity ?? 1,
            price: c.price,
            compare_at_price: c.compareAt,
            compare_at_until: c.compareAt !== null ? c.compareAtUntil : null,
            is_default: variants.length === 0,
          })
          .select("id")
          .single();
        if (ve) throw ve;
        const { error: ie } = await db.from("inventory").insert({ tenant_id: store.tenant_id, variant_id: v.id, warehouse_id: store.warehouse_id, stock: c.stock });
        if (ie) throw ie;
        results.push({ index: i, sku: c.sku, status: created ? "created" : "updated" });
        continue;
      }

      const vPatch: Record<string, unknown> = {};
      if (c.price !== null && Number(variant.price) !== c.price) vPatch.price = c.price;
      if (c.compareAt !== null) {
        // The old price must stay above the price actually in force.
        const effective = c.price ?? Number(variant.price);
        if (c.compareAt <= effective) throw new Error("compare_at_price must be higher than the price");
        vPatch.compare_at_price = c.compareAt;
        vPatch.compare_at_until = c.compareAtUntil;
      }
      if (c.unit) vPatch.unit = c.unit;
      if (c.quantity !== null) vPatch.quantity = c.quantity;
      if (Object.keys(vPatch).length) {
        const { error } = await db.from("product_variants").update(vPatch).eq("id", variant.id);
        if (error) throw error;
        touched = true;
      }
      if (c.stock !== null) {
        const inv = (variant.inventory ?? []).find((x: any) => x.warehouse_id === store.warehouse_id);
        if (inv) {
          if (Number(inv.stock) !== c.stock) {
            const { error } = await db.from("inventory").update({ stock: c.stock }).eq("id", inv.id);
            if (error) throw error;
            touched = true;
          }
        } else {
          const { error } = await db.from("inventory").insert({ tenant_id: store.tenant_id, variant_id: variant.id, warehouse_id: store.warehouse_id, stock: c.stock });
          if (error) throw error;
          touched = true;
        }
      }
      results.push({ index: i, sku: c.sku, status: touched ? "updated" : "unchanged" });
    } catch (e: any) {
      const msg = e?.message ?? "Could not save this row.";
      results.push({ index: i, sku: c.sku, status: "error", error: /duplicate key|unique/i.test(msg) ? "This sku or pack already exists." : msg });
    }
  }
  return results;
}

export async function listStoreProducts(store: SyncStore, page: number, size: number) {
  const db: any = createServiceClient();
  const from = (page - 1) * size;
  const { data, count, error } = await db
    .from("products")
    .select("id, sku, name, name_ar, brand, is_active, category:categories(name, slug), product_variants(id, label, unit, quantity, price, compare_at_price, compare_at_until, inventory(stock, warehouse_id))", { count: "exact" })
    .eq("store_id", store.id)
    .order("created_at", { ascending: false })
    .range(from, from + size - 1);
  if (error) throw error;
  return {
    total: count ?? 0,
    page,
    size,
    products: (data ?? []).map((p: any) => ({
      sku: publicSku(store.id, p.sku),
      name: p.name,
      name_ar: p.name_ar,
      brand: p.brand,
      active: p.is_active,
      category: p.category?.slug ?? null,
      packs: (p.product_variants ?? []).map((v: any) => ({
        variant_label: v.label,
        unit: v.unit,
        quantity: Number(v.quantity),
        price: Number(v.price),
        compare_at_price: v.compare_at_price == null ? null : Number(v.compare_at_price),
        compare_at_until: v.compare_at_until,
        stock: Number((v.inventory ?? []).find((x: any) => x.warehouse_id === store.warehouse_id)?.stock ?? 0),
      })),
    })),
  };
}

export async function listStoreOrders(store: SyncStore, opts: { since?: string; status?: string; limit: number }) {
  const db: any = createServiceClient();
  let q = db
    .from("order_items")
    .select("order_id, product_name, variant_label, ordered_quantity, packed_quantity, unit_price, line_total, orders!inner(order_number, status, created_at, currency, delivery_type), product_variants!inner(products!inner(sku, store_id))")
    .eq("product_variants.products.store_id", store.id)
    .order("created_at", { ascending: false })
    .limit(opts.limit * 5);
  if (opts.since) q = q.gte("orders.created_at", opts.since);
  if (opts.status) q = q.eq("orders.status", opts.status);
  const { data, error } = await q;
  if (error) throw error;
  const byOrder = new Map<string, any>();
  for (const r of data ?? []) {
    const o = byOrder.get(r.order_id) ?? {
      order_number: r.orders.order_number,
      status: r.orders.status,
      placed_at: r.orders.created_at,
      currency: r.orders.currency,
      delivery_type: r.orders.delivery_type,
      items: [],
    };
    o.items.push({
      sku: publicSku(store.id, r.product_variants?.products?.sku ?? null),
      name: r.product_name,
      variant_label: r.variant_label,
      quantity: Number(r.ordered_quantity),
      packed_quantity: r.packed_quantity == null ? null : Number(r.packed_quantity),
      unit_price: Number(r.unit_price),
      line_total: Number(r.line_total),
    });
    byOrder.set(r.order_id, o);
  }
  return [...byOrder.values()].slice(0, opts.limit);
}

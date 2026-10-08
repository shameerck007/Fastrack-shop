import { createClient } from "@/lib/supabase/server";

// The master catalog (migration 0067): shared product definitions that suppliers sell by adding offers.
// The tables arrive with the migration and are not in the generated types, so they are read through a loose handle.

export interface MasterVariant {
  id: string;
  label: string;
  labelAr: string | null;
  unit: string;
  quantity: number;
  barcode: string | null;
  isDefault: boolean;
}

export interface MasterProduct {
  id: string;
  name: string;
  nameAr: string | null;
  brand: string | null;
  brandAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  categoryId: string | null;
  categoryName: string | null;
  imageUrl: string | null;
  barcode: string | null;
  hsnCode: string | null;
  taxRate: number | null;
  status: "approved" | "pending" | "rejected";
  requestedByStore: string | null;
  requestedByName: string | null;
  rejectionReason: string | null;
  createdAt: string;
  variants: MasterVariant[];
  /** How many suppliers sell it (admin view). */
  offers: number;
}

interface Row {
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
  status: "approved" | "pending" | "rejected";
  requested_by_store: string | null;
  rejection_reason: string | null;
  created_at: string;
  categories: { name: string } | null;
  stores: { name: string } | null;
  master_variants: { id: string; label: string; label_ar: string | null; unit: string; quantity: number; barcode: string | null; is_default: boolean; sort_order: number }[];
}

const SELECT =
  "id, name, name_ar, brand, brand_ar, description, description_ar, category_id, image_url, barcode, hsn_code, tax_rate, status, requested_by_store, rejection_reason, created_at, categories(name), stores:requested_by_store(name), master_variants(id, label, label_ar, unit, quantity, barcode, is_default, sort_order)";

function toProduct(r: Row, offers = 0): MasterProduct {
  return {
    id: r.id,
    name: r.name,
    nameAr: r.name_ar,
    brand: r.brand,
    brandAr: r.brand_ar,
    description: r.description,
    descriptionAr: r.description_ar,
    categoryId: r.category_id,
    categoryName: r.categories?.name ?? null,
    imageUrl: r.image_url,
    barcode: r.barcode,
    hsnCode: r.hsn_code,
    taxRate: r.tax_rate == null ? null : Number(r.tax_rate),
    status: r.status,
    requestedByStore: r.requested_by_store,
    requestedByName: r.stores?.name ?? null,
    rejectionReason: r.rejection_reason,
    createdAt: r.created_at,
    variants: [...(r.master_variants ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => ({ id: v.id, label: v.label, labelAr: v.label_ar, unit: v.unit, quantity: Number(v.quantity), barcode: v.barcode, isDefault: v.is_default })),
    offers,
  };
}

type Query = {
  select: (c: string) => Query;
  eq: (c: string, v: string) => Query;
  in: (c: string, v: string[]) => Query;
  order: (c: string, o: object) => Query;
  limit: (n: number) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
  not: (c: string, op: string, v: unknown) => Query;
};

/** Returns null (not an error) when the catalog tables are not there yet, so the pages can show a setup note. */
export async function getMasterCatalog(opts: { status?: "approved" | "pending" | "rejected"; limit?: number } = {}): Promise<MasterProduct[] | null> {
  const supabase = (await createClient()) as unknown as { from: (t: string) => Query };
  let q = supabase.from("master_products").select(SELECT);
  if (opts.status) q = q.eq("status", opts.status);
  const { data, error } = await q.order("name", { ascending: true }).limit(opts.limit ?? 1000);
  if (error) return null;
  const rows = (data ?? []) as unknown as Row[];

  // How many suppliers sell each product.
  const offers = new Map<string, number>();
  const ids = rows.map((r) => r.id);
  if (ids.length > 0) {
    const real = await createClient();
    const { data: linked } = await real.from("products").select("master_id").in("master_id" as never, ids as never);
    for (const l of (linked ?? []) as unknown as { master_id: string }[]) offers.set(l.master_id, (offers.get(l.master_id) ?? 0) + 1);
  }
  return rows.map((r) => toProduct(r, offers.get(r.id) ?? 0));
}

export interface CatalogPage {
  items: MasterProduct[];
  total: number;
  /** Set when the query failed for a reason other than the tables being absent. */
  error?: string;
}

export interface CatalogSearchOptions {
  status: "approved" | "pending" | "rejected";
  q?: string;
  /** A category; its sub-categories are included. */
  categoryId?: string;
  requestedByStore?: string;
  page?: number;
  pageSize?: number;
  withOffers?: boolean;
}

/**
 * One page of the catalog, filtered on the server (the catalog is thousands of products, so it is never loaded whole).
 * Uses the one-round-trip database function from migration 0069; until that is run it falls back to plain table queries.
 */
export async function searchMasterCatalog(opts: CatalogSearchOptions): Promise<CatalogPage | null> {
  if (!opts.requestedByStore) {
    const pageSize = opts.pageSize ?? 48;
    const page = Math.max(1, opts.page ?? 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any;
    const { data, error } = await supabase.rpc("search_master_products", {
      p_status: opts.status,
      p_q: opts.q ?? null,
      p_category: opts.categoryId && opts.categoryId !== "all" ? opts.categoryId : null,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
      p_offers: !!opts.withOffers,
    });
    if (!error && data) {
      const d = data as { total: number; items: (Row & { offers?: number })[] };
      return { items: d.items.map((r) => toProduct(r, Number(r.offers ?? 0))), total: Number(d.total) };
    }
    // Any other failure falls through to the table queries below, which report a real error.
  }
  return searchViaTables(opts);
}

async function searchViaTables(opts: CatalogSearchOptions): Promise<CatalogPage | null> {
  const pageSize = opts.pageSize ?? 48;
  const page = Math.max(1, opts.page ?? 1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  let categoryIds: string[] | undefined;
  if (opts.categoryId && opts.categoryId !== "all") {
    const { data: kids } = await supabase.from("categories").select("id").eq("parent_id", opts.categoryId);
    categoryIds = [opts.categoryId, ...((kids ?? []) as { id: string }[]).map((k) => k.id)];
  }
  const filtered = (select: string, options?: { count: "exact"; head: true }) => {
    let q = supabase.from("master_products").select(select, options).eq("status", opts.status);
    if (opts.requestedByStore) q = q.eq("requested_by_store", opts.requestedByStore);
    if (categoryIds) q = q.in("category_id", categoryIds);
    const needle = (opts.q ?? "").trim().replace(/[,()*%\\"]/g, " ").replace(/\s+/g, " ").trim();
    if (needle) {
      const like = `%${needle}%`;
      const parts = [`name.ilike.${like}`, `brand.ilike.${like}`, `name_ar.ilike.${like}`];
      if (/^\d{6,}$/.test(needle)) parts.push(`barcode.eq.${needle}`);
      q = q.or(parts.join(","));
    }
    return q;
  };
  const from = (page - 1) * pageSize;
  const [{ data, error }, { count, error: countError }] = await Promise.all([
    filtered(SELECT).order("name", { ascending: true }).range(from, from + pageSize - 1),
    filtered("id", { count: "exact", head: true }),
  ]);
  const failure = error ?? countError;
  if (failure) {
    // The catalog tables arrive with migration 0067; anything else is a real failure worth showing.
    if (failure.code === "42P01" || failure.code === "PGRST205" || /does not exist|schema cache/i.test(failure.message ?? "")) return null;
    return { items: [], total: 0, error: failure.message ?? "The catalog query failed" };
  }
  const rows = (data ?? []) as Row[];
  const offers = new Map<string, number>();
  if (opts.withOffers && rows.length > 0) {
    const real = await createClient();
    const { data: linked } = await real.from("products").select("master_id").in("master_id" as never, rows.map((r) => r.id) as never);
    for (const l of (linked ?? []) as unknown as { master_id: string }[]) offers.set(l.master_id, (offers.get(l.master_id) ?? 0) + 1);
  }
  return { items: rows.map((r) => toProduct(r, offers.get(r.id) ?? 0)), total: count ?? rows.length };
}

/** Number of catalog products with a status (for the headline tiles and tabs). */
export async function countMaster(status: "approved" | "pending", requestedByStore?: string): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  let q = supabase.from("master_products").select("id", { count: "exact", head: true }).eq("status", status);
  if (requestedByStore) q = q.eq("requested_by_store", requestedByStore);
  const { count } = await q;
  return count ?? 0;
}

/** The master products this supplier already sells (so the catalog can show "In your store"). */
export async function getStoreMasterIds(storeId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("master_id").eq("store_id", storeId).not("master_id" as never, "is", null);
  return new Set(((data ?? []) as unknown as { master_id: string }[]).map((d) => d.master_id));
}

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

/** The master products this supplier already sells (so the catalog can show "In your store"). */
export async function getStoreMasterIds(storeId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("master_id").eq("store_id", storeId).not("master_id" as never, "is", null);
  return new Set(((data ?? []) as unknown as { master_id: string }[]).map((d) => d.master_id));
}

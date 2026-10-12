import { createClient } from "@/lib/supabase/server";

export interface HomeOffer {
  id: string;
  name: string;
  nameAr: string | null;
  code: string | null;
  auto: boolean;
  kind: "percent" | "fixed" | "free_delivery";
  value: number;
  maxDiscount: number | null;
  minOrder: number | null;
  categorySlug: string | null;
  storeId: string | null;
  endsAt: string | null;
  firstOrderOnly: boolean;
}

interface Row {
  id: string; name: string; name_ar: string | null; code: string | null; auto_apply: boolean; kind: HomeOffer["kind"];
  value: number | string; max_discount: number | string | null; min_order: number | string | null; category_slug: string | null;
  store_id: string | null; ends_at: string | null; first_order_only: boolean;
}

/** Admin offers a shopper may see on the home page. Empty when none, or before the offers migration is in. */
export async function getHomeOffers(): Promise<HomeOffer[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as unknown as { rpc: (f: string) => Promise<{ data: Row[] | null; error: unknown }> }).rpc("public_offers");
    if (error || !data) return [];
    return data.map((r) => ({
      id: r.id, name: r.name, nameAr: r.name_ar, code: r.code, auto: r.auto_apply, kind: r.kind, value: Number(r.value),
      maxDiscount: r.max_discount == null ? null : Number(r.max_discount), minOrder: r.min_order == null ? null : Number(r.min_order),
      categorySlug: r.category_slug, storeId: r.store_id, endsAt: r.ends_at, firstOrderOnly: r.first_order_only,
    }));
  } catch {
    return [];
  }
}

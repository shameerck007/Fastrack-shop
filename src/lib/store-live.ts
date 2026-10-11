import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * A supplier shop only goes live for customers once it can be delivered from: its GPS pin when common delivery areas are used,
 * otherwise a delivery boundary set by an admin. Until then its products stay hidden. Returns the approved suppliers that are still waiting for an area.
 * FasTrack's own products have no store and are never listed here.
 */
async function getNotLiveStoreIdsImpl(): Promise<string[]> {
  try {
    const supabase = await createClient();
    const [{ data, error }, areasResult] = await Promise.all([supabase.rpc("public_delivery_zones"), supabase.rpc("public_delivery_areas" as never)]);
    if (error || !data) return [];
    const rows = data as { store_id: string | null; lat: number | null; lng: number | null; radius_km: number | null; polygon: unknown }[];
    // With common delivery areas a shop only needs its GPS pin to be live; otherwise it needs its own boundary.
    const usingAreas = !areasResult.error && Array.isArray(areasResult.data) && areasResult.data.length > 0;
    return rows
      .filter((z) => z.store_id && (usingAreas ? z.lat == null || z.lng == null : z.radius_km == null && !(Array.isArray(z.polygon) && z.polygon.length >= 3)))
      .map((z) => z.store_id as string);
  } catch {
    return [];
  }
}

export const getNotLiveStoreIds = cache(getNotLiveStoreIdsImpl);

/** PostgREST `.or()` filter that keeps FasTrack's own products and every live supplier's (always true when nothing is hidden). */
export function liveProductsFilter(notLiveIds: string[]): string {
  return notLiveIds.length === 0 ? "store_id.is.null,store_id.not.is.null" : `store_id.is.null,store_id.not.in.(${notLiveIds.join(",")})`;
}

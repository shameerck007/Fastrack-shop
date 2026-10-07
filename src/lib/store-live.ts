import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * A supplier shop only goes live for customers once an admin has set its delivery area (an Express radius or a drawn area).
 * Until then its products stay hidden. Returns the approved suppliers that are still waiting for an area.
 * FasTrack's own products have no store and are never listed here.
 */
async function getNotLiveStoreIdsImpl(): Promise<string[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("public_delivery_zones");
    if (error || !data) return [];
    return (data as { store_id: string | null; radius_km: number | null; polygon: unknown }[])
      .filter((z) => z.store_id && z.radius_km == null && !(Array.isArray(z.polygon) && z.polygon.length >= 3))
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

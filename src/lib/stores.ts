import { createClient } from "@/lib/supabase/server";
import { formatNextOpening, getOpenStatus, type OpeningHours } from "@/lib/store-hours";

export interface StoreDirectoryEntry {
  id: string;
  name: string;
  city: string;
  logo_url: string | null;
  cover_url: string | null;
  tagline: string | null;
  opening_hours: OpeningHours;
  accepting_orders: boolean;
}

/** Every approved store's public (storefront-safe) fields. Returns an empty
 * list if the function isn't there yet, so a not-yet-run migration degrades
 * to "everything open, no logos" rather than breaking the shop. */
export async function getStoreDirectory(): Promise<StoreDirectoryEntry[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("public_store_directory");
    if (error) return [];
    return (data as StoreDirectoryEntry[] | null) ?? [];
  } catch {
    return [];
  }
}

/** Throws a shopper-readable error if any of these stores can't take orders
 * right now (closed hours, or paused by the merchant). FasTrack's own
 * products (null store) and unknown stores are never blocked here. */
export async function assertStoresOpen(storeIds: (string | null | undefined)[]): Promise<void> {
  const ids = [...new Set(storeIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return;

  const directory = await getStoreDirectory();
  for (const id of ids) {
    const store = directory.find((s) => s.id === id);
    if (!store) continue;
    const status = getOpenStatus(store.opening_hours, store.accepting_orders);
    if (status.open) continue;
    if (status.reason === "paused") {
      throw new Error(`${store.name} isn't taking orders right now.`);
    }
    const when = status.next ? ` Opens ${formatNextOpening(status.next, "en", { today: "today at", tomorrow: "tomorrow at" })}.` : "";
    throw new Error(`${store.name} is closed right now.${when}`);
  }
}

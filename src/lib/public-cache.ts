import "server-only";
import { createClient as createSupabase, type SupabaseClient } from "@supabase/supabase-js";
import { getCurrentTenant } from "@/lib/tenant-server";
import { tenantHeaders } from "@/lib/tenant";
import type { Database } from "@/types/database";

/**
 * A short memory of what every shopper sees on the home page (categories, featured, fresh and offer products, which shops are live).
 * Without it each visit asks the database for the same lists again, and the database sits far from the visitor. The lists are the same
 * for everyone in a market, so they are fetched once a minute per market with an anonymous (not signed-in) connection, which is exactly what a
 * signed-out shopper would be allowed to read anyway, and shared by the visits that follow. A change an admin makes shows within a minute.
 * Failures are never remembered. Each server instance keeps its own memory, so the worst case is one extra fetch per instance per minute.
 */
const TTL_MS = 60_000;
const MAX_ENTRIES = 200;
const memory = new Map<string, { at: number; value: Promise<unknown> }>();

export type PublicDb = SupabaseClient<Database>;

export async function cachedPublic<T>(key: string, load: (db: PublicDb) => Promise<T>): Promise<T> {
  const tenant = await getCurrentTenant().catch(() => null);
  const k = `${tenant?.id ?? "-"}:${key}`;
  const now = Date.now();
  const hit = memory.get(k);
  if (hit && now - hit.at < TTL_MS) return hit.value as Promise<T>;
  if (memory.size >= MAX_ENTRIES) {
    for (const [old, v] of memory) if (now - v.at >= TTL_MS) memory.delete(old);
    if (memory.size >= MAX_ENTRIES) memory.clear();
  }
  const db = createSupabase<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: tenantHeaders(tenant?.id) },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const value = load(db);
  memory.set(k, { at: now, value });
  value.catch(() => {
    if (memory.get(k)?.value === value) memory.delete(k);
  });
  return value;
}

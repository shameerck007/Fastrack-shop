"use server";

import { revalidatePath } from "next/cache";
import { UserError, failure } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { newApiKey, sha256Hex, KEY_PREFIX } from "@/lib/supplier-api-auth";
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

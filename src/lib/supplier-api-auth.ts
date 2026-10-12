import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { SyncStore } from "@/lib/supplier-sync";

export const KEY_PREFIX = "ftk_";
const CALLS_PER_MINUTE = 60;

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function newApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${KEY_PREFIX}${b64}`;
}

export const apiError = (status: number, message: string) => NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
export const apiJson = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Checks the "Authorization: Bearer ftk_..." header. Returns the key's store, or the error response to send back. */
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function authenticateSupplier(req: Request): Promise<{ store: SyncStore } | { response: NextResponse }> {
  const header = req.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!key.startsWith(KEY_PREFIX) || key.length < 20 || key.length > 100) return { response: apiError(401, "Missing or invalid API key. Send it as: Authorization: Bearer ftk_...") };

  const db: any = createServiceClient();
  const { data: row } = await db
    .from("supplier_api_keys")
    .select("id, revoked_at, store:stores(id, tenant_id, warehouse_id, status)")
    .eq("key_hash", await sha256Hex(key))
    .maybeSingle();
  if (!row || row.revoked_at) return { response: apiError(401, "Missing or invalid API key.") };
  const store = row.store;
  if (!store || store.status !== "approved" || !store.warehouse_id) return { response: apiError(403, "This store is not approved to sell yet.") };

  const { data: calls } = await db.rpc("supplier_api_hit", { p_key: row.id });
  if (typeof calls === "number" && calls > CALLS_PER_MINUTE) {
    return { response: NextResponse.json({ error: `Too many calls. The limit is ${CALLS_PER_MINUTE} per minute per key.` }, { status: 429, headers: { "Retry-After": "30" } }) };
  }
  await db.from("supplier_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);
  return { store: { id: store.id, tenant_id: store.tenant_id, warehouse_id: store.warehouse_id } };
}

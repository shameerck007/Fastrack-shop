import { apiError, apiJson, authenticateSupplier } from "@/lib/supplier-api-auth";
import { listStoreProducts, syncProducts, MAX_ROWS_PER_CALL, type SyncRow } from "@/lib/supplier-sync";

/** GET: the supplier's products, with packs, prices and stock. */
export async function GET(req: Request) {
  const auth = await authenticateSupplier(req);
  if ("response" in auth) return auth.response;
  const u = new URL(req.url).searchParams;
  const page = Math.max(1, Number(u.get("page")) || 1);
  const size = Math.min(100, Math.max(1, Number(u.get("size")) || 50));
  try {
    return apiJson(await listStoreProducts(auth.store, page, size));
  } catch {
    return apiError(500, "Could not load products.");
  }
}

/** POST { items: [...] }: create new products and update existing ones (matched by sku and variant_label). */
export async function POST(req: Request) {
  const auth = await authenticateSupplier(req);
  if ("response" in auth) return auth.response;
  let body: { items?: SyncRow[] };
  try {
    body = await req.json();
  } catch {
    return apiError(400, "The body must be JSON like { \"items\": [ ... ] }.");
  }
  if (!Array.isArray(body.items) || body.items.length === 0) return apiError(400, "Send { \"items\": [ ... ] } with at least one item.");
  if (body.items.length > MAX_ROWS_PER_CALL) return apiError(413, `Send at most ${MAX_ROWS_PER_CALL} items per call.`);
  try {
    const results = await syncProducts(auth.store, body.items, { createMissing: true });
    const failed = results.filter((r) => r.status === "error").length;
    return apiJson({ ok: failed === 0, failed, results }, failed === results.length ? 422 : 200);
  } catch (e) {
    return apiError(500, e instanceof Error ? e.message : "Could not save the items.");
  }
}

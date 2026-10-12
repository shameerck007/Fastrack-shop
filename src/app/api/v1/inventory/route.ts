import { apiError, apiJson, authenticateSupplier } from "@/lib/supplier-api-auth";
import { syncProducts, MAX_ROWS_PER_CALL, type SyncRow } from "@/lib/supplier-sync";

/** PATCH { items: [{ sku, variant_label?, stock?, price?, compare_at_price? }] }: update price and stock of products that already exist. Never creates. */
export async function PATCH(req: Request) {
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
  // Only the stock and price fields count here, whatever else was sent.
  const items = body.items.map((r) => ({ sku: r?.sku, variant_label: r?.variant_label, stock: r?.stock, price: r?.price, compare_at_price: r?.compare_at_price, compare_at_until: r?.compare_at_until }));
  try {
    const results = await syncProducts(auth.store, items, { createMissing: false });
    const failed = results.filter((r) => r.status === "error").length;
    return apiJson({ ok: failed === 0, failed, results }, failed === results.length ? 422 : 200);
  } catch (e) {
    return apiError(500, e instanceof Error ? e.message : "Could not update the items.");
  }
}

import { apiError, apiJson, authenticateSupplier } from "@/lib/supplier-api-auth";
import { listStoreOrders } from "@/lib/supplier-sync";

/** GET ?since=2026-01-01&status=confirmed&limit=50: orders that contain this supplier's items (only their own items are listed). */
export async function GET(req: Request) {
  const auth = await authenticateSupplier(req);
  if ("response" in auth) return auth.response;
  const u = new URL(req.url).searchParams;
  const since = u.get("since");
  if (since && Number.isNaN(new Date(since).getTime())) return apiError(400, "since must be a date like 2026-01-31.");
  try {
    const orders = await listStoreOrders(auth.store, {
      since: since ? new Date(since).toISOString() : undefined,
      status: u.get("status") ?? undefined,
      limit: Math.min(100, Math.max(1, Number(u.get("limit")) || 50)),
    });
    return apiJson({ orders });
  } catch {
    return apiError(500, "Could not load orders.");
  }
}

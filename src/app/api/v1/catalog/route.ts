import { apiError, apiJson, authenticateSupplier } from "@/lib/supplier-api-auth";
import { lookupCatalogBarcode } from "@/lib/supplier-sync";

/** GET ?barcode=3057640379048: is this product in the FasTrack catalog? If so, you only send price and stock for it. */
export async function GET(req: Request) {
  const auth = await authenticateSupplier(req);
  if ("response" in auth) return auth.response;
  const barcode = new URL(req.url).searchParams.get("barcode") ?? "";
  if (!barcode) return apiError(400, "Send ?barcode=… (8 to 14 digits).");
  try {
    const r = await lookupCatalogBarcode(auth.store, barcode);
    if ("error" in r) return apiError(400, r.error as string);
    return apiJson(r);
  } catch {
    return apiError(500, "Could not look up the barcode.");
  }
}

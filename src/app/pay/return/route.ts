import { NextResponse } from "next/server";
import { finalizeSession } from "@/lib/payment-finalize";

/**
 * Where the shopper lands after the card payment (and any bank confirmation). The address carries our checkout id and the
 * payment id Moyasar added. We never trust the "status" in the address: the payment is looked up at Moyasar and only then
 * are the orders created. Then the shopper goes to their order, or back to checkout with a plain explanation.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("s") ?? "";
  const paymentId = url.searchParams.get("id");
  const back = (path: string) => NextResponse.redirect(new URL(path, url.origin), 303);
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return back("/cart");
  try {
    const out = await finalizeSession(sessionId, paymentId && /^[0-9a-f-]{36}$/i.test(paymentId) ? paymentId : null);
    if (out.state === "placed") {
      const dest = out.orderIds.length === 1 ? `/orders/${out.orderIds[0]}` : "/orders";
      return back(out.note ? `${dest}${dest.includes("?") ? "&" : "?"}notice=${encodeURIComponent(out.note)}` : dest);
    }
    if (out.state === "pending") return back(`/checkout?pay=pending`);
    return back(`/checkout?pay_error=${encodeURIComponent(out.message)}`);
  } catch {
    return back(`/checkout?pay_error=${encodeURIComponent("We could not confirm your payment yet. If you were charged, your order will appear in My orders or the payment is refunded automatically.")}`);
  }
}

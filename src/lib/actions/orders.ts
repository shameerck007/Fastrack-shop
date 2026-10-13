"use server";



import { friendlyMessage, unwrapAction } from "@/lib/errors";
import { UserError, failure } from "@/lib/errors";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { placeOrderOrThrow, type PlaceOrderInput } from "@/lib/place-order";
import { getCartItems } from "@/lib/cart";
import { getVariantStockMap } from "@/lib/inventory";
import { checkProductsDeliverable, resolveProductWarehouses, type StockNeeds } from "@/lib/delivery-zones";
import { combineMethods, splitDeliveryFee, standardDeliveryDate } from "@/lib/delivery-methods";
import { getDeliveryPricing } from "@/lib/delivery-pricing";
import { OFFER_REASON_EN, quoteForCart } from "@/lib/offers";
import { DEFAULT_ETA_SETTINGS, etaRange } from "@/lib/eta";
import { getCompanySettings } from "@/lib/company-settings";
import { marketOffsetMinutes } from "@/lib/timezone";
import { getCurrentTenant } from "@/lib/tenant-server";
import { SERVICE_AREA_MESSAGE, stateInServiceArea } from "@/lib/india";
import { assertStoresOpen } from "@/lib/stores";
import { addToCart } from "@/lib/actions/cart";
import { notifyUsers } from "@/lib/push";
import { sendOrderConfirmationEmail, sendNewOrderEmails } from "@/lib/email-notifications";
import { generateOrderNumber, generateOtp } from "@/lib/utils";
import { deliveryTaxRate, extractTax, productTaxRate } from "@/lib/tax";
import type { DeliveryType, PaymentMethod } from "@/types/database";


/** Amazon-style "Buy it again": re-adds every item from a past order to the
 * cart in one go. Best-effort per line — an item that's now out of stock,
 * discontinued, or outside the current delivery area is skipped rather
 * than failing the whole reorder, and the skipped count is reported back
 * so the UI can say "2 of 3 items added" instead of silently dropping
 * items or hard-failing on the first problem. */
export async function reorderItems(orderId: string) {
  try {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError("You must be logged in.");

  const { data: order } = await supabase
    .from("orders")
    .select("id, user_id, order_items(variant_id, ordered_quantity)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.user_id !== user.id) throw new UserError("Order not found.");

  let added = 0;
  let skipped = 0;
  for (const item of order.order_items as { variant_id: string; ordered_quantity: number }[]) {
    try {
      const result = await unwrapAction(addToCart)(item.variant_id, item.ordered_quantity);
      if (result.error) skipped++;
      else added++;
    } catch {
      skipped++;
    }
  }

  revalidatePath("/cart");
  return await { added, skipped };

  } catch (e) {
    return failure(e) as never;
  }
}

/** Same reason as addToCart: expected refusals (closed shop, no stock, outside
 * the delivery area...) come back as { error } so the real message survives
 * production. On success placeOrderOrThrow redirects, which must propagate. */
export async function placeOrder(input: PlaceOrderInput): Promise<{ error: string }> {
  try {
  try {
    await placeOrderOrThrow(input);
    return await { error: "" };
  } catch (err) {
    const digest = (err as { digest?: string } | null)?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw err;
    return await { error: friendlyMessage(err, "Could not place your order.")};
  }

  } catch (e) {
    return failure(e) as never;
  }
}

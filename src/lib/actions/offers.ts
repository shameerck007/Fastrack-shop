"use server";


import { failure } from "@/lib/errors";
import { getCartItems } from "@/lib/cart";
import { quoteForCart, type OfferQuote } from "@/lib/offers";

/** Checkout: what a coupon code (or, with no code, the best automatic offer) takes off the current cart. */
export async function quoteOffer(code: string | null): Promise<OfferQuote> {
  try {
  const items = await getCartItems();
  return await quoteForCart(code?.trim() || null, items);

  } catch (e) {
    return failure(e) as never;
  }
}

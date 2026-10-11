"use server";



import { friendlyMessage } from "@/lib/errors";
import { UserError, failure } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { getVariantStock } from "@/lib/inventory";
import { checkProductsDeliverable, getCustomerLocation } from "@/lib/delivery-zones";
import { assertStoresOpen } from "@/lib/stores";

async function getOrCreateCartId(): Promise<string> {
  const supabase = await createClient();
  // getUser() normally resolves { user: null } for a guest rather than
  // throwing, but if the underlying auth fetch itself fails (seen from
  // certain mobile webviews before any session cookie exists), it can
  // throw a Supabase-specific error class instead of a plain Error —
  // which doesn't survive the Server Action -> client serialization
  // boundary cleanly and surfaces as an opaque RSC render error instead
  // of "you must be logged in". Normalize any failure here to the same
  // plain, expected error so the client's login-redirect handling always
  // has something it can actually match against.
  let user;
  try {
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch {
    throw new UserError("You must be logged in.");
  }

  if (!user) throw new UserError("You must be logged in.");

  const { data: existing } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("carts")
    .insert({ user_id: user.id })
    .select("id")
    .single();

  if (error) throw error;
  return created.id;
}

/** The most one order may hold of this variant's product (null = no limit). Read on its own so a missing column never breaks adding to the cart. */
async function maxQtyOfVariant(variantId: string): Promise<{ max: number | null; name: string }> {
  const supabase = await createClient();
  const { data } = await supabase.from("product_variants").select("products(name, max_order_qty)").eq("id", variantId).maybeSingle();
  const p = (data as unknown as { products: { name: string; max_order_qty?: number | null } | null } | null)?.products;
  return { max: p?.max_order_qty ?? null, name: p?.name ?? "this item" };
}

async function addToCartOrThrow(
  variantId: string,
  quantity: number,
  location?: { lat: number; lng: number }
) {
  const supabase = await createClient();

  // Enforce the seller's delivery boundary against the customer's delivery
  // location before anything is added — the UI also hides the button, but
  // this is the real gate.
  const { data: variantRow } = await supabase
    .from("product_variants")
    .select("products(id, name, store_id)")
    .eq("id", variantId)
    .maybeSingle();
  const product = (variantRow as unknown as { products: { id: string; name: string; store_id: string | null } | null } | null)
    ?.products;
  if (product) {
    // A closed or paused supplier can't take new items, same as at checkout.
    await assertStoresOpen([product.store_id]);
    // The shopper's chosen browsing location if given, else their default
    // address. Checkout re-checks against the actual delivery address.
    const where = location ?? (await getCustomerLocation());
    const result = (await checkProductsDeliverable([product], where)).get(product.id);
    if (result?.message) throw new UserError(result.message);
  }

  const cartId = await getOrCreateCartId();

  const { data: existing } = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("cart_id", cartId)
    .eq("variant_id", variantId)
    .maybeSingle();

  const requestedTotal = (existing?.quantity ?? 0) + quantity;
  const limit = await maxQtyOfVariant(variantId);
  if (limit.max !== null && requestedTotal > limit.max) {
    const have = existing?.quantity ?? 0;
    throw new UserError(have >= limit.max ? `You've reached the limit of ${limit.max} per order for this item.` : `You can buy up to ${limit.max} of this item per order — you already have ${have} in your cart.`);
  }
  const available = await getVariantStock(variantId);
  if (requestedTotal > available) {
    throw new UserError(
      available > 0
        ? `Only ${available} left in stock — you already have ${existing?.quantity ?? 0} in your cart.`
        : "This item is out of stock."
    );
  }

  if (existing) {
    const { error } = await supabase
      .from("cart_items")
      .update({ quantity: requestedTotal })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("cart_items").insert({
      cart_id: cartId,
      variant_id: variantId,
      quantity,
    });
    if (error) throw error;
  }

}

/** Returns { error } instead of throwing: in production a thrown message never reaches the shopper. */
export async function updateCartItemQuantity(cartItemId: string, quantity: number): Promise<{ error?: string }> {
  try {
  const supabase = await createClient();

  if (quantity <= 0) {
    const { error } = await supabase.from("cart_items").delete().eq("id", cartItemId);
    return await error ? { error: friendlyMessage(error) } : {};
  }
  const { data: item } = await supabase.from("cart_items").select("variant_id").eq("id", cartItemId).maybeSingle();
  if (item) {
    const limit = await maxQtyOfVariant(item.variant_id);
    if (limit.max !== null && quantity > limit.max) return await { error: `You can buy up to ${limit.max} of this item per order.` };
    const available = await getVariantStock(item.variant_id);
    if (quantity > available) return await { error: `Only ${available} left in stock.` };
  }
  const { error } = await supabase.from("cart_items").update({ quantity }).eq("id", cartItemId);
  return await error ? { error: friendlyMessage(error) } : {};

  } catch (e) {
    return failure(e) as never;
  }
}

export async function removeCartItem(cartItemId: string) {
  try {
  const supabase = await createClient();
  const { error } = await supabase.from("cart_items").delete().eq("id", cartItemId);
  if (error) throw error;

  } catch (e) {
    return failure(e) as never;
  }
}

/** Why this returns a result instead of throwing: in production, Next.js
 * replaces the message of any error thrown out of a server action with a
 * generic placeholder ("An error occurred in the Server Components render",
 * shown as React error #441), so "shop is closed" or "not enough stock"
 * would never reach the shopper. Returned values are not redacted. */
export async function addToCart(
  variantId: string,
  quantity: number,
  location?: { lat: number; lng: number }
): Promise<{ error?: string }> {
  try {
  try {
    await addToCartOrThrow(variantId, quantity, location);
    return await {};
  } catch (err) {
    return await { error: friendlyMessage(err, "Could not add to cart.")};
  }

  } catch (e) {
    return failure(e) as never;
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getVariantStock } from "@/lib/inventory";

async function getOrCreateCartId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("You must be logged in.");

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

export async function addToCart(variantId: string, quantity: number) {
  const supabase = await createClient();
  const cartId = await getOrCreateCartId();

  const { data: existing } = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("cart_id", cartId)
    .eq("variant_id", variantId)
    .maybeSingle();

  const requestedTotal = (existing?.quantity ?? 0) + quantity;
  const available = await getVariantStock(variantId);
  if (requestedTotal > available) {
    throw new Error(
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

  revalidatePath("/cart");
}

export async function updateCartItemQuantity(cartItemId: string, quantity: number) {
  const supabase = await createClient();

  if (quantity <= 0) {
    const { error } = await supabase.from("cart_items").delete().eq("id", cartItemId);
    if (error) throw error;
  } else {
    const { data: item } = await supabase
      .from("cart_items")
      .select("variant_id")
      .eq("id", cartItemId)
      .maybeSingle();

    if (item) {
      const available = await getVariantStock(item.variant_id);
      if (quantity > available) {
        throw new Error(`Only ${available} left in stock.`);
      }
    }

    const { error } = await supabase
      .from("cart_items")
      .update({ quantity })
      .eq("id", cartItemId);
    if (error) throw error;
  }

  revalidatePath("/cart");
}

export async function removeCartItem(cartItemId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("cart_items").delete().eq("id", cartItemId);
  if (error) throw error;
  revalidatePath("/cart");
}

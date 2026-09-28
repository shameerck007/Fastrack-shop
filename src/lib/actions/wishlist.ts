"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  // See getOrCreateCartId in lib/actions/cart.ts — normalizes any failure
  // from the auth check itself (not just "no user") to a plain Error, so
  // it always survives the Server Action -> client boundary cleanly.
  let user;
  try {
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch {
    throw new Error("You must be logged in.");
  }
  if (!user) throw new Error("You must be logged in.");
  return user;
}

export async function toggleWishlist(productId: string): Promise<{ inList: boolean }> {
  const supabase = await createClient();
  const user = await requireUser(supabase);

  const { data: existing } = await supabase
    .from("wishlist_items")
    .select("id")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("wishlist_items").delete().eq("id", existing.id);
    if (error) throw error;
    revalidatePath("/account/lists");
    return { inList: false };
  }

  const { error } = await supabase.from("wishlist_items").insert({ user_id: user.id, product_id: productId });
  if (error) throw error;
  revalidatePath("/account/lists");
  return { inList: true };
}

export async function removeFromWishlist(productId: string) {
  const supabase = await createClient();
  const user = await requireUser(supabase);

  const { error } = await supabase
    .from("wishlist_items")
    .delete()
    .eq("user_id", user.id)
    .eq("product_id", productId);
  if (error) throw error;
  revalidatePath("/account/lists");
}

import { createClient } from "@/lib/supabase/server";
import type { CartItemWithVariant } from "@/types/database";

export async function getCartItems(): Promise<CartItemWithVariant[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: cart } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!cart) return [];

  const { data, error } = await supabase
    .from("cart_items")
    .select("*, product_variants(*, products(*))")
    .eq("cart_id", cart.id)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data as CartItemWithVariant[]) ?? [];
}

export function cartSubtotal(items: CartItemWithVariant[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.product_variants.price, 0);
}

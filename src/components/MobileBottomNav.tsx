import { createClient } from "@/lib/supabase/server";
import { getCartItemCount } from "@/lib/cart";
import MobileBottomNavClient from "@/components/MobileBottomNavClient";

export default async function MobileBottomNav() {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    cartCount,
  ] = await Promise.all([supabase.auth.getUser(), getCartItemCount()]);

  return <MobileBottomNavClient cartCount={cartCount} isLoggedIn={!!user} />;
}

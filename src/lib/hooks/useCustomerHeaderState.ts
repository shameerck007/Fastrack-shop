"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export interface CustomerHeaderState {
  loaded: boolean;
  signedIn: boolean;
  firstName: string | null;
  cartCount: number;
}

const INITIAL_STATE: CustomerHeaderState = {
  loaded: false,
  signedIn: false,
  firstName: null,
  cartCount: 0,
};

// Auth/cart state is fetched client-side (not on the server per request) to
// avoid forcing every page into dynamic SSR — see UserHeaderActions for why.
// Re-running on every pathname change (rather than once on mount) is what
// keeps the cart badge correct after actions like checkout, which clear the
// cart server-side and redirect: without this, the badge would keep showing
// stale pre-checkout counts since navigating to a new route under the same
// layout doesn't remount this component.
export function useCustomerHeaderState(): CustomerHeaderState {
  const pathname = usePathname();
  const [state, setState] = useState<CustomerHeaderState>(INITIAL_STATE);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (cancelled) return;
      if (!user) {
        setState(INITIAL_STATE);
        return;
      }

      const [{ data: profile }, { data: cart }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("carts").select("id").eq("user_id", user.id).maybeSingle(),
      ]);
      if (cancelled) return;

      let cartCount = 0;
      if (cart) {
        const { data: items } = await supabase.from("cart_items").select("quantity").eq("cart_id", cart.id);
        cartCount = (items ?? []).reduce((sum, item) => sum + item.quantity, 0);
      }
      if (!cancelled) {
        setState({
          loaded: true,
          signedIn: true,
          firstName: profile?.full_name?.split(" ")[0] ?? null,
          cartCount,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return state;
}

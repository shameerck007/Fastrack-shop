"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CART_CHANGED_EVENT } from "@/lib/cart-events";

export interface CustomerHeaderState {
  loaded: boolean;
  signedIn: boolean;
  firstName: string | null;
  cartCount: number;
  cartTotal: number;
  /** Sum of (compare-at price - price) over the cart: what the shopper saves. */
  cartSavings: number;
  /** variant id -> cart line id and quantity, so cards can show a - qty + stepper. */
  cartLines: Record<string, { id: string; qty: number }>;
}

const INITIAL_STATE: CustomerHeaderState = {
  loaded: false,
  signedIn: false,
  firstName: null,
  cartCount: 0,
  cartTotal: 0,
  cartSavings: 0,
  cartLines: {},
};

// Auth/cart state is fetched client-side (not on the server per request) to
// avoid forcing every page into dynamic SSR — see UserHeaderActions for why.
// Re-running on every pathname change (rather than once on mount) is what
// keeps the cart badge correct after actions like checkout, which clear the
// cart server-side and redirect: without this, the badge would keep showing
// stale pre-checkout counts since navigating to a new route under the same
// layout doesn't remount this component.
export function useFetchCustomerState(): CustomerHeaderState {
  const pathname = usePathname();
  const [state, setState] = useState<CustomerHeaderState>(INITIAL_STATE);
  const [cartVersion, setCartVersion] = useState(0);

  // Cart mutations that stay on the same page (add to cart, +/- quantity)
  // don't change the pathname, so they signal via this event instead.
  useEffect(() => {
    const onChange = () => setCartVersion((v) => v + 1);
    window.addEventListener(CART_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CART_CHANGED_EVENT, onChange);
  }, []);

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
      let cartTotal = 0;
      let cartSavings = 0;
      const cartLines: Record<string, { id: string; qty: number }> = {};
      if (cart) {
        const { data: items } = await supabase
          .from("cart_items")
          .select("id, variant_id, quantity, product_variants(price, compare_at_price)")
          .eq("cart_id", cart.id);
        for (const item of (items ?? []) as unknown as {
          id: string;
          variant_id: string;
          quantity: number;
          product_variants: { price: number; compare_at_price: number | null } | null;
        }[]) {
          const price = item.product_variants?.price ?? 0;
          const compare = item.product_variants?.compare_at_price ?? 0;
          cartCount += item.quantity;
          cartTotal += item.quantity * price;
          if (compare > price) cartSavings += item.quantity * (compare - price);
          cartLines[item.variant_id] = { id: item.id, qty: item.quantity };
        }
      }
      if (!cancelled) {
        setState({
          loaded: true,
          signedIn: true,
          firstName: profile?.full_name?.split(" ")[0] ?? null,
          cartCount,
          cartTotal,
          cartSavings,
          cartLines,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pathname, cartVersion]);

  return state;
}

export const CustomerStateCtx = createContext<CustomerHeaderState>(INITIAL_STATE);

/** Everything that shows cart/login state reads it from here, so it is loaded
 * once by CustomerStateProvider instead of once per product card or button. */
export function useCustomerHeaderState(): CustomerHeaderState {
  return useContext(CustomerStateCtx);
}

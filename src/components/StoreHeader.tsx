"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function StoreHeader({ storeName }: { storeName: string }) {
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (cancelled || !user) return;
      const { data: cart } = await supabase.from("carts").select("id").eq("user_id", user.id).maybeSingle();
      if (cancelled || !cart) return;
      const { data: items } = await supabase.from("cart_items").select("quantity").eq("cart_id", cart.id);
      if (!cancelled) {
        setCartCount((items ?? []).reduce((sum, item) => sum + item.quantity, 0));
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-neutral-900">{storeName}</p>
          <p className="text-xs text-neutral-400">Powered by FasTrack Shop</p>
        </div>
        <Link href="/cart" className="relative flex shrink-0 items-center gap-1 text-sm hover:text-blue-600">
          🛒 Cart
          {cartCount > 0 && (
            <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
              {cartCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}

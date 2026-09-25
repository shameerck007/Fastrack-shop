"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function UserHeaderActions() {
  const [loaded, setLoaded] = useState(false);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (cancelled) return;
      if (!user) {
        setSignedIn(false);
        setLoaded(true);
        return;
      }
      setSignedIn(true);

      const [{ data: profile }, { data: cart }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("carts").select("id").eq("user_id", user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      setFirstName(profile?.full_name?.split(" ")[0] ?? null);

      if (cart) {
        const { data: items } = await supabase
          .from("cart_items")
          .select("quantity")
          .eq("cart_id", cart.id);
        if (!cancelled) {
          setCartCount((items ?? []).reduce((sum, item) => sum + item.quantity, 0));
        }
      }
      setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex items-center gap-4 text-sm">
      <Link href="/orders" className="leading-tight hover:text-blue-600">
        <span className="block text-[11px] text-neutral-500">Returns</span>
        <span className="font-medium">& Orders</span>
      </Link>
      <Link href="/cart" className="relative flex items-center gap-1 hover:text-blue-600">
        🛒 Cart
        {loaded && cartCount > 0 && (
          <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
            {cartCount}
          </span>
        )}
      </Link>
      {signedIn ? (
        <Link href="/account" className="leading-tight hover:text-blue-600">
          <span className="block text-[11px] text-neutral-500">Hello, {firstName ?? "there"}</span>
          <span className="font-medium">Account</span>
        </Link>
      ) : (
        <Link
          href="/login"
          className="rounded-full bg-blue-700 px-4 py-1.5 text-white hover:bg-blue-800"
        >
          Login
        </Link>
      )}
    </div>
  );
}

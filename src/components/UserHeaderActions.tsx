"use client";

import Link from "next/link";
import { useCustomerHeaderState } from "@/lib/hooks/useCustomerHeaderState";

export default function UserHeaderActions() {
  const { loaded, signedIn, firstName, cartCount } = useCustomerHeaderState();

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

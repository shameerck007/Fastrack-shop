"use client";

import { useState } from "react";
import Link from "next/link";
import Flag from "@/components/Flag";
import MarketSwitchDialog from "@/components/MarketSwitchDialog";
import { findCountry } from "@/lib/countries";
import type { Tenant } from "@/lib/tenant";

/** Shown instead of an order that was placed in another country: nothing about the order is displayed here. */
export default function OrderOtherCountry({
  orderCountry,
  tenants,
  currentId,
  canSwitch,
}: {
  orderCountry: string;
  tenants: Tenant[];
  currentId: string | null;
  canSwitch: boolean;
}) {
  const [open, setOpen] = useState(false);
  const country = findCountry(orderCountry);
  const target = tenants.find((t) => t.country_code === orderCountry) ?? null;
  const current = tenants.find((t) => t.id === currentId) ?? null;

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <Flag code={orderCountry} className="mx-auto h-10 w-[54px]" />
      <h1 className="mt-4 text-xl font-extrabold tracking-tight text-neutral-900">This order is in {country.name}</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Orders are kept separately for each country, so it isn&apos;t shown while you are shopping in {current ? findCountry(current.country_code).name : "another country"}.
      </p>
      {canSwitch && target && current ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-6 h-12 rounded-full bg-blue-700 px-8 font-extrabold text-white shadow-lg shadow-blue-700/25 hover:bg-blue-800"
        >
          Switch to {country.name} to view it
        </button>
      ) : (
        <p className="mt-5 text-sm text-neutral-500">Sign in with a customer login for {country.name} to view this order.</p>
      )}
      <Link href="/orders" className="mt-4 block text-sm font-medium text-blue-600 hover:underline">
        Back to my orders
      </Link>
      <MarketSwitchDialog open={open} target={target} current={current} onClose={() => setOpen(false)} />
    </div>
  );
}

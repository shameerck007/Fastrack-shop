"use client";

import Flag from "@/components/Flag";
import { findCountry } from "@/lib/countries";
import type { Tenant } from "@/lib/tenant";

/** For supplier, rider, admin and warehouse accounts: the country is fixed by the account, so the menu is locked and says why. */
export default function LockedMarketPill({ tenant }: { tenant: Tenant }) {
  const country = findCountry(tenant.country_code);
  return (
    <details className="group relative shrink-0">
      <summary
        aria-label="Country locked"
        className="flex cursor-pointer list-none items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1.5 text-sm font-semibold text-blue-800 hover:bg-blue-100 [&::-webkit-details-marker]:hidden"
      >
        <Flag code={tenant.country_code} className="h-4 w-[22px]" />
        <span className="hidden lg:inline">{country.name}</span>
        <span className="text-xs opacity-70">🔒</span>
      </summary>
      <div className="absolute end-0 top-full z-50 mt-2 w-64 rounded-2xl border border-neutral-200 bg-white p-4 text-sm shadow-xl">
        <p className="flex items-center gap-2 font-bold text-neutral-900">
          <Flag code={tenant.country_code} className="h-[18px] w-6" />
          {country.name}
        </p>
        <p className="mt-1.5 text-neutral-600">
          Your account works in {country.name}, so the country can&apos;t be changed here.
        </p>
        <p className="mt-2 text-xs text-neutral-500">To shop in another country, sign in with a customer login or browse without signing in.</p>
      </div>
    </details>
  );
}

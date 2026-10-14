import Link from "@/components/Link";
import Wordmark from "@/components/Wordmark";
import { getCompanySettings } from "@/lib/company-settings";
import { getCurrentTenant } from "@/lib/tenant-server";
import { findCountry } from "@/lib/countries";

/**
 * "About and legal" at the very bottom of the account page: the policy links and the company's registration details. On phones the shop
 * pages carry no footer (like Noon and Amazon's apps), so this is where a shopper finds them. On desktop the page footer shows them instead.
 */
export default async function AccountLegal() {
  const company = await getCompanySettings();
  const tenant = await getCurrentTenant().catch(() => null);
  const countryCode = tenant?.country_code ?? "SA";
  const isIndia = countryCode === "IN";
  const countryName = findCountry(countryCode).name;
  const year = new Date().getFullYear();
  const links = [
    { href: "/terms", label: "Conditions of Use" },
    { href: "/privacy", label: "Privacy Notice" },
    { href: "/sell", label: "Sell on FasTrack" },
    { href: "/deliver", label: "Deliver with FasTrack" },
  ];

  return (
    <section className="mt-8 border-t border-neutral-200 pt-5 md:hidden">
      <h2 className="mb-2 text-sm font-extrabold tracking-tight text-neutral-900">About and legal</h2>
      <ul className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex items-center justify-between px-4 py-3 text-sm font-medium text-neutral-800 hover:bg-brand-50">
              {l.label}
              <span aria-hidden className="text-neutral-400 rtl:-scale-x-100">›</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-col items-center gap-2 text-center">
        <Wordmark height={20} />
        <p className="max-w-xs text-xs text-neutral-500">
          {company.trading_name}
          {company.cr_number ? ` · ${isIndia ? "PAN" : "CR"} ${company.cr_number}` : ""}
          {company.vat_number ? ` · ${isIndia ? "GSTIN" : "VAT"} ${company.vat_number}` : ""}
          {company.city ? ` · ${company.city}, ${countryName}` : ""}
        </p>
        <p className="text-xs text-neutral-500">&copy; {year} {company.trading_name}. All rights reserved.</p>
      </div>
    </section>
  );
}

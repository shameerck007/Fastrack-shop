import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import { getCompanySettings } from "@/lib/company-settings";

export default async function Footer() {
  const company = await getCompanySettings();
  const year = new Date().getFullYear();

  const columns = [
    {
      heading: "Get to know us",
      links: [
        { href: "/", label: "About FasTrack" },
        { href: "/sell", label: "Sell on FasTrack" },
      ],
    },
    {
      heading: "Let us help you",
      links: [
        { href: "/orders", label: "Your orders" },
        { href: "/account", label: "Your account" },
        { href: "/addresses", label: "Your addresses" },
      ],
    },
    {
      heading: "Policies",
      links: [
        { href: "/terms", label: "Conditions of Use" },
        { href: "/privacy", label: "Privacy Notice" },
      ],
    },
  ];

  return (
    <footer className="mt-16 border-t border-neutral-200 bg-neutral-900 text-neutral-300">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {columns.map((col) => (
            <div key={col.heading}>
              <h3 className="mb-3 text-sm font-semibold text-white">{col.heading}</h3>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-neutral-400 hover:text-white hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 border-t border-neutral-800 pt-6 text-center">
          <Wordmark height={22} />
          <p className="max-w-md text-xs text-neutral-500">
            {company.trading_name}
            {company.cr_number ? ` · CR ${company.cr_number}` : ""}
            {company.vat_number ? ` · VAT ${company.vat_number}` : ""}
            {company.city ? ` · ${company.city}, Saudi Arabia` : ""}
          </p>
          <p className="text-xs text-neutral-600">&copy; {year} {company.trading_name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

import Link from "next/link";
import { findCountry } from "@/lib/countries";
import type { MarketSummary } from "@/lib/platform";

/** "All markets / Saudi Arabia / India" pills shown on every platform page. The choice lives in
 * the address (?market=slug), so it can be bookmarked and shared. Other query values are kept. */
export default function MarketFilter({
  markets,
  current,
  basePath,
  keep = {},
}: {
  markets: MarketSummary[];
  current: string | null;
  basePath: string;
  keep?: Record<string, string | undefined>;
}) {
  const href = (slug: string | null) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(keep)) if (v) params.set(k, v);
    if (slug) params.set("market", slug);
    const q = params.toString();
    return q ? `${basePath}?${q}` : basePath;
  };
  const pill = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
      active ? "bg-blue-600 text-white shadow-md shadow-blue-600/25" : "bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-blue-50 hover:text-blue-700"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="me-1 text-xs font-semibold uppercase tracking-wider text-neutral-400">Market</span>
      <Link href={href(null)} className={pill(current === null)}>
        🌐 All markets
      </Link>
      {markets.map((m) => (
        <Link key={m.slug} href={href(m.slug)} className={pill(current === m.slug)}>
          <span>{findCountry(m.country_code).flag}</span>
          {findCountry(m.country_code).name}
          {m.status !== "active" && <span className={`rounded-full px-1.5 text-[10px] ${current === m.slug ? "bg-white/20" : "bg-amber-100 text-amber-700"}`}>{m.status}</span>}
        </Link>
      ))}
    </div>
  );
}

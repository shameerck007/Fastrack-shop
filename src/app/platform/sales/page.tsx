import Link from "next/link";
import PlatformHeader from "@/components/platform/PlatformHeader";
import MarketFilter from "@/components/platform/MarketFilter";
import { findCountry } from "@/lib/countries";
import { moneyFor } from "@/lib/money";
import { getMarketSummaries, getSalesByDay, pickMarkets } from "@/lib/platform";

const RANGES = [7, 14, 30, 90];

function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export default async function PlatformSalesPage({ searchParams }: { searchParams: Promise<{ days?: string; market?: string }> }) {
  const { days: raw, market } = await searchParams;
  const days = RANGES.includes(Number(raw)) ? Number(raw) : 30;
  const [allMarkets, sales] = await Promise.all([getMarketSummaries(), getSalesByDay(days)]);
  const { shown: markets, current } = pickMarkets(allMarkets, market);
  const marketQuery = current ? `&market=${current}` : "";

  return (
    <div className="flex flex-col gap-5">
      <PlatformHeader icon="💰" title="Sales" subtitle="Sales per day for each market, cancelled orders excluded. Each table is in that market's own currency.">
        <MarketFilter markets={allMarkets} current={current} basePath="/platform/sales" keep={{ days: String(days) }} />
      </PlatformHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/platform/sales?days=${r}${marketQuery}`}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${days === r ? "bg-blue-600 text-white shadow-md shadow-blue-600/25" : "bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-blue-50"}`}
            >
              {r} days
            </Link>
          ))}
        </div>
        <a href={`/platform/sales/export?days=${days}${marketQuery}`} className="rounded-full border border-neutral-300 bg-white px-4 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
          ⬇ Download CSV
        </a>
      </div>

      {markets.map((m) => {
        const money = moneyFor(m.currency);
        const rows = sales.filter((s) => s.tenant_id === m.tenant_id).sort((a, b) => (a.day < b.day ? 1 : -1));
        const totals = rows.reduce(
          (t, r) => ({ orders: t.orders + r.orders, gmv: t.gmv + r.gmv, fees: t.fees + r.delivery_fees, tax: t.tax + r.tax }),
          { orders: 0, gmv: 0, fees: 0, tax: 0 }
        );
        return (
          <section key={m.tenant_id} className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
              <h2 className="flex items-center gap-2 text-base font-extrabold tracking-tight">
                <span className="text-2xl">{findCountry(m.country_code).flag}</span>
                {m.name}
              </h2>
              <span className="text-xs text-neutral-400">{m.currency}</span>
            </div>
            {rows.length === 0 ? (
              <p className="p-5 text-sm text-neutral-500">No sales in the last {days} days.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 text-left text-xs font-medium uppercase tracking-wide text-neutral-400">
                      <th className="px-5 py-2.5">Date</th>
                      <th className="px-3 py-2.5 text-right">Orders</th>
                      <th className="px-3 py-2.5 text-right">Sales</th>
                      <th className="px-3 py-2.5 text-right">Avg order</th>
                      <th className="px-3 py-2.5 text-right">Delivery fees</th>
                      <th className="px-5 py-2.5 text-right">{m.country_code === "IN" ? "GST" : "VAT"} inside</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {rows.map((r) => (
                      <tr key={r.day} className="hover:bg-neutral-50">
                        <td className="px-5 py-2.5 font-medium text-neutral-800">{formatDay(r.day)}</td>
                        <td className="px-3 py-2.5 text-right text-neutral-600">{r.orders}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-neutral-900">{money(r.gmv)}</td>
                        <td className="px-3 py-2.5 text-right text-neutral-600">{money(r.orders > 0 ? r.gmv / r.orders : 0)}</td>
                        <td className="px-3 py-2.5 text-right text-neutral-600">{money(r.delivery_fees)}</td>
                        <td className="px-5 py-2.5 text-right text-neutral-600">{money(r.tax)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-neutral-200 bg-blue-50/60 font-bold">
                      <td className="px-5 py-3">Total</td>
                      <td className="px-3 py-3 text-right">{totals.orders}</td>
                      <td className="px-3 py-3 text-right">{money(totals.gmv)}</td>
                      <td className="px-3 py-3 text-right">{money(totals.orders > 0 ? totals.gmv / totals.orders : 0)}</td>
                      <td className="px-3 py-3 text-right">{money(totals.fees)}</td>
                      <td className="px-5 py-3 text-right">{money(totals.tax)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

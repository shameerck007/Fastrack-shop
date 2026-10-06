import { createClient } from "@/lib/supabase/server";
import PlatformHeader from "@/components/platform/PlatformHeader";
import { CreateMarketForm, MarketStatusButtons } from "@/components/platform/MarketControls";
import { findCountry } from "@/lib/countries";
import { moneyFor } from "@/lib/money";
import { getMarketSummaries } from "@/lib/platform";
import Flag from "@/components/Flag";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  draft: "bg-amber-50 text-amber-700",
  suspended: "bg-red-50 text-red-700",
};

export default async function PlatformMarketsPage() {
  const supabase = await createClient();
  const [markets, { data: countries }] = await Promise.all([
    getMarketSummaries(),
    (supabase as unknown as { from: (t: string) => { select: (c: string) => Promise<{ data: { code: string; name: string; currency: string }[] | null }> } })
      .from("countries")
      .select("code, name, currency"),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PlatformHeader
        icon="🌍"
        title="Markets"
        subtitle="Each market is an independent shop with its own customers, suppliers, riders, products, orders and money. Open a market when it is ready, hide it to pause new visitors."
      />

      <CreateMarketForm countries={countries ?? []} />

      <div className="grid gap-4">
        {markets.map((m) => {
          const country = findCountry(m.country_code);
          const money = moneyFor(m.currency);
          return (
            <section key={m.tenant_id} className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Flag code={m.country_code} className="h-9 w-12" />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-extrabold tracking-tight">{m.name}</h2>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_BADGE[m.status]}`}>
                        {m.status === "active" ? "Live" : m.status === "draft" ? "Draft" : "Suspended"}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-500">
                      {country.name} · {m.currency} · <span className="font-mono text-xs">{m.slug}</span>
                    </p>
                  </div>
                </div>
                <MarketStatusButtons tenantId={m.tenant_id} status={m.status} name={m.name} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {[
                  ["Sales · 30 days", money(m.gmv_30d)],
                  ["Orders · 30 days", String(m.orders_30d)],
                  ["Suppliers", `${m.suppliers_active}${m.suppliers_pending ? ` (+${m.suppliers_pending})` : ""}`],
                  ["Riders", `${m.riders_approved}${m.riders_pending ? ` (+${m.riders_pending})` : ""}`],
                  ["Customers", String(m.customers_total)],
                  ["Products", String(m.products_active)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-neutral-50 px-3 py-2">
                    <p className="text-[11px] text-neutral-500">{label}</p>
                    <p className="text-sm font-bold text-neutral-900">{value}</p>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <p className="rounded-2xl bg-blue-50 px-4 py-3 text-xs text-blue-900">
        Numbers in brackets are applications waiting for review. A market that is a draft or suspended is invisible to customers; its staff can still sign in and set things up.
      </p>
    </div>
  );
}

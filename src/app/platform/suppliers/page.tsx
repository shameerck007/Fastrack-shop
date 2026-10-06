import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PlatformHeader from "@/components/platform/PlatformHeader";
import MarketFilter from "@/components/platform/MarketFilter";
import { findCountry } from "@/lib/countries";
import { moneyFor } from "@/lib/money";
import { getMarketSummaries, getTopSuppliers, pickMarkets } from "@/lib/platform";

interface StoreRow {
  id: string;
  name: string;
  status: string;
  city: string | null;
  country: string | null;
  state: string | null;
  cr_number: string | null;
  vat_number: string | null;
  commission_rate: number;
  tenant_id: string;
  created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  rejected: "bg-red-50 text-red-600",
  suspended: "bg-neutral-100 text-neutral-500",
};

export default async function PlatformSuppliersPage({ searchParams }: { searchParams: Promise<{ market?: string }> }) {
  const { market } = await searchParams;
  const supabase = await createClient();
  const [allMarkets, top, { data }] = await Promise.all([
    getMarketSummaries(),
    getTopSuppliers(30, 200),
    supabase
      .from("stores")
      .select("id, name, status, city, country, state, cr_number, vat_number, commission_rate, tenant_id, created_at")
      .order("created_at", { ascending: false }),
  ]);
  const { shown, current } = pickMarkets(allMarkets, market);
  const stores = (data ?? []) as unknown as StoreRow[];
  const salesByStore = new Map(top.map((t) => [t.store_id, t]));

  return (
    <div className="flex flex-col gap-5">
      <PlatformHeader icon="🏪" title="Suppliers" subtitle="Every supplier in every market, with its sales over the last 30 days. Open one to review documents, edit its shop or record a payout.">
        <MarketFilter markets={allMarkets} current={current} basePath="/platform/suppliers" />
      </PlatformHeader>

      {shown.map((m) => {
        const money = moneyFor(m.currency);
        const rows = stores.filter((s) => s.tenant_id === m.tenant_id);
        const isIndia = m.country_code === "IN";
        return (
          <section key={m.tenant_id} className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
              <h2 className="flex items-center gap-2 text-base font-extrabold tracking-tight">
                <span className="text-2xl">{findCountry(m.country_code).flag}</span>
                {m.name}
              </h2>
              <span className="text-xs text-neutral-500">
                {m.suppliers_active} live{m.suppliers_pending ? ` · ${m.suppliers_pending} pending` : ""}
              </span>
            </div>
            {rows.length === 0 ? (
              <p className="p-5 text-sm text-neutral-500">No suppliers in this market yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 text-left text-xs font-medium uppercase tracking-wide text-neutral-400">
                      <th className="px-5 py-2.5">Supplier</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">{isIndia ? "GSTIN" : "VAT no."}</th>
                      <th className="px-3 py-2.5 text-right">Commission</th>
                      <th className="px-3 py-2.5 text-right">Orders · 30d</th>
                      <th className="px-3 py-2.5 text-right">Sales · 30d</th>
                      <th className="px-5 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {rows.map((s) => {
                      const sale = salesByStore.get(s.id);
                      return (
                        <tr key={s.id} className="hover:bg-neutral-50">
                          <td className="px-5 py-3">
                            <Link href={`/admin/merchants/${s.id}`} className="font-semibold text-neutral-900 hover:text-blue-600">
                              {s.name}
                            </Link>
                            <p className="text-[11px] text-neutral-400">{[s.city, s.state].filter(Boolean).join(", ")}</p>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_BADGE[s.status] ?? "bg-neutral-100"}`}>{s.status}</span>
                          </td>
                          <td className="px-3 py-3 font-mono text-xs text-neutral-600">{s.vat_number ?? "—"}</td>
                          <td className="px-3 py-3 text-right text-neutral-600">{s.commission_rate}%</td>
                          <td className="px-3 py-3 text-right text-neutral-600">{sale?.orders ?? 0}</td>
                          <td className="px-3 py-3 text-right font-semibold text-neutral-900">{money(sale?.gross_sales ?? 0)}</td>
                          <td className="px-5 py-3 text-right">
                            <Link href={`/admin/settlements/${s.id}`} className="text-xs font-medium text-blue-600 hover:underline">
                              Settlement
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

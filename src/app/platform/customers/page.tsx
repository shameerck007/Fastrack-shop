import { createClient } from "@/lib/supabase/server";
import PlatformHeader from "@/components/platform/PlatformHeader";
import { findCountry } from "@/lib/countries";
import { moneyFor } from "@/lib/money";
import { getMarketSummaries, pickMarkets } from "@/lib/platform";

interface CustomerRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  tenant_id: string;
}

interface OrderRow {
  user_id: string;
  total: number;
  status: string;
  tenant_id: string;
}

export default async function PlatformCustomersPage() {
    const supabase = await createClient();
  const [allMarkets, { data: profiles }, { data: orders }] = await Promise.all([
    getMarketSummaries(),
    supabase.from("profiles").select("id, full_name, phone, created_at, tenant_id").eq("role", "customer").order("created_at", { ascending: false }).limit(500),
    supabase.from("orders").select("user_id, total, status, tenant_id").neq("status", "cancelled").limit(10000),
  ]);
  const { shown, current } = await pickMarkets(allMarkets);
  const customers = (profiles ?? []) as unknown as CustomerRow[];
  const orderRows = (orders ?? []) as unknown as OrderRow[];

  return (
    <div className="flex flex-col gap-5">
      <PlatformHeader icon="👥" title="Customers" subtitle="Shoppers in the selected country, with orders placed and amount spent.">
      </PlatformHeader>

      {shown.map((m) => {
        const money = moneyFor(m.currency);
        const rows = customers.filter((c) => c.tenant_id === m.tenant_id);
        const stats = new Map<string, { orders: number; spent: number }>();
        for (const o of orderRows) {
          if (o.tenant_id !== m.tenant_id) continue;
          const cur = stats.get(o.user_id) ?? { orders: 0, spent: 0 };
          cur.orders += 1;
          cur.spent += Number(o.total);
          stats.set(o.user_id, cur);
        }
        return (
          <section key={m.tenant_id} className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
              <h2 className="flex items-center gap-2 text-base font-extrabold tracking-tight">
                <span className="text-2xl">{findCountry(m.country_code).flag}</span>
                {m.name}
              </h2>
              <span className="text-xs text-neutral-500">
                {m.customers_total} customers{m.customers_new_30d ? ` · +${m.customers_new_30d} in 30 days` : ""}
              </span>
            </div>
            {rows.length === 0 ? (
              <p className="p-5 text-sm text-neutral-500">No customers in this market yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 text-left text-xs font-medium uppercase tracking-wide text-neutral-400">
                      <th className="px-5 py-2.5">Customer</th>
                      <th className="px-3 py-2.5">Phone</th>
                      <th className="px-3 py-2.5">Joined</th>
                      <th className="px-3 py-2.5 text-right">Orders</th>
                      <th className="px-5 py-2.5 text-right">Spent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {rows.map((c) => {
                      const st = stats.get(c.id);
                      return (
                        <tr key={c.id} className="hover:bg-neutral-50">
                          <td className="px-5 py-2.5">
                            <span className="flex items-center gap-2.5 font-medium text-neutral-900">
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">
                                {(c.full_name ?? "?").charAt(0).toUpperCase()}
                              </span>
                              {c.full_name ?? "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-neutral-600">{c.phone ?? "—"}</td>
                          <td className="px-3 py-2.5 text-neutral-500">{new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                          <td className="px-3 py-2.5 text-right text-neutral-700">{st?.orders ?? 0}</td>
                          <td className="px-5 py-2.5 text-right font-semibold text-neutral-900">{money(st?.spent ?? 0)}</td>
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

import Link from "@/components/Link";
import { createClient } from "@/lib/supabase/server";
import PlatformHeader from "@/components/platform/PlatformHeader";
import { findCountry } from "@/lib/countries";
import { moneyFor } from "@/lib/money";
import { getMarketSummaries, pickMarkets } from "@/lib/platform";
import Flag from "@/components/Flag";

interface RiderRow {
  id: string;
  status: string;
  is_available: boolean;
  vehicle_type: string | null;
  city: string | null;
  rating: number | null;
  payout_method: string | null;
  tenant_id: string;
  profiles: { full_name: string | null; phone: string | null } | null;
}

interface Balance {
  rider_id: string;
  delivered_count: number;
  balance: number;
}

const STATUS_BADGE: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  rejected: "bg-red-50 text-red-600",
  suspended: "bg-neutral-100 text-neutral-500",
};

export default async function PlatformRidersPage({ params }: { params: Promise<{ country: string }> }) {
  const { country } = await params;
    const supabase = await createClient();
  const loose = supabase as unknown as { rpc: (fn: string) => Promise<{ data: Record<string, unknown>[] | null }> };
  const [allMarkets, { data }, balancesRaw] = await Promise.all([
    getMarketSummaries(),
    supabase.from("delivery_partners").select("id, status, is_available, vehicle_type, city, rating, payout_method, tenant_id, profiles(full_name, phone)"),
    loose.rpc("admin_rider_settlement_overview").then((r) => r.data ?? []),
  ]);
  const { shown, current } = pickMarkets(allMarkets, country);
  const riders = (data ?? []) as unknown as RiderRow[];
  const balances = new Map<string, Balance>(
    balancesRaw.map((b) => [String(b.rider_id), { rider_id: String(b.rider_id), delivered_count: Number(b.delivered_count), balance: Number(b.balance) }])
  );

  return (
    <div className="flex flex-col gap-5">
      <PlatformHeader icon="🛵" title="Riders" subtitle="Riders in the selected country. A negative balance means the rider is holding cash-on-delivery money that FasTrack has not received yet.">
      </PlatformHeader>

      {shown.map((m) => {
        const money = moneyFor(m.currency);
        const rows = riders.filter((r) => r.tenant_id === m.tenant_id);
        return (
          <section key={m.tenant_id} className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
              <h2 className="flex items-center gap-2 text-base font-extrabold tracking-tight">
                <Flag code={m.country_code} className="h-6 w-8" />
                {m.name}
              </h2>
              <span className="text-xs text-neutral-500">
                {m.riders_approved} approved · {m.riders_online} online{m.riders_pending ? ` · ${m.riders_pending} pending` : ""}
              </span>
            </div>
            {rows.length === 0 ? (
              <p className="p-5 text-sm text-neutral-500">No riders in this market yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 text-left text-xs font-medium uppercase tracking-wide text-neutral-400">
                      <th className="px-5 py-2.5">Rider</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Vehicle</th>
                      <th className="px-3 py-2.5 text-right">Deliveries</th>
                      <th className="px-3 py-2.5 text-right">Rating</th>
                      <th className="px-3 py-2.5 text-right">Balance</th>
                      <th className="px-5 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {rows.map((r) => {
                      const b = balances.get(r.id);
                      return (
                        <tr key={r.id} className="hover:bg-neutral-50">
                          <td className="px-5 py-3">
                            <Link href={`/admin/riders/${r.id}`} className="font-semibold text-neutral-900 hover:text-blue-600">
                              {r.profiles?.full_name ?? "—"}
                            </Link>
                            <p className="text-[11px] text-neutral-400">
                              {r.city ?? ""} {r.payout_method === "bank" ? "· bank payout" : "· cash payout"}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_BADGE[r.status] ?? "bg-neutral-100"}`}>{r.status}</span>
                            {r.status === "approved" && (
                              <span className={`ms-1.5 inline-flex items-center gap-1 text-[11px] ${r.is_available ? "text-emerald-600" : "text-neutral-400"}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${r.is_available ? "bg-emerald-500" : "bg-neutral-300"}`} />
                                {r.is_available ? "online" : "offline"}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 capitalize text-neutral-600">{r.vehicle_type ?? "—"}</td>
                          <td className="px-3 py-3 text-right text-neutral-600">{b?.delivered_count ?? 0}</td>
                          <td className="px-3 py-3 text-right text-neutral-600">{r.rating ?? "—"}</td>
                          <td className={`px-3 py-3 text-right font-semibold ${b && b.balance < -0.005 ? "text-red-600" : b && b.balance > 0.005 ? "text-amber-700" : "text-neutral-500"}`}>
                            {b ? (b.balance < -0.005 ? `−${money(-b.balance)}` : money(b.balance)) : "—"}
                            {b && Math.abs(b.balance) > 0.005 && <span className="block text-[10px] font-normal">{b.balance < 0 ? "rider owes us" : "we owe rider"}</span>}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Link href={`/admin/rider-settlements/${r.id}`} className="text-xs font-medium text-blue-600 hover:underline">
                              Ledger
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

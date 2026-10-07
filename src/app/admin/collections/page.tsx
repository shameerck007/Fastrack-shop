import CollectionsPanel from "@/components/CollectionsPanel";
import {
  getRiderSettlementOverview,
  getRiderSettlementOrders,
  getAllRiderSettlementEntries,
  type RiderSettlementOrder,
} from "@/lib/rider-settlements";
import { buildPeriods, type PeriodMode } from "@/lib/finance-periods";
import { getCurrentTenant, getMoney } from "@/lib/tenant-server";

export const metadata = { title: "Collections" };

export default async function AdminCollectionsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const mode: PeriodMode = view === "monthly" ? "monthly" : "daily";
  const money = await getMoney();
  const tenant = await getCurrentTenant().catch(() => null);
  const timeZone = tenant?.country_code === "IN" ? "Asia/Kolkata" : "Asia/Riyadh";

  let failed = false;
  let riders: Awaited<ReturnType<typeof getRiderSettlementOverview>> = [];
  let entries: Awaited<ReturnType<typeof getAllRiderSettlementEntries>> = [];
  const ordersByRider = new Map<string, RiderSettlementOrder[]>();
  try {
    riders = await getRiderSettlementOverview();
    entries = await getAllRiderSettlementEntries();
    const lists = await Promise.all(riders.map((r) => getRiderSettlementOrders(r.riderId).catch(() => [])));
    riders.forEach((r, i) => ordersByRider.set(r.riderId, lists[i]));
  } catch {
    failed = true;
  }

  const allOrders = [...ordersByRider.values()].flat();
  const rows = buildPeriods(allOrders, entries, mode, timeZone);
  const current = rows[0];

  // Who owes what for the current period.
  const perRider = riders
    .map((r) => {
      const mine = buildPeriods(ordersByRider.get(r.riderId) ?? [], entries.filter((e) => e.riderId === r.riderId), mode, timeZone)[0];
      return { r, ...mine };
    })
    .filter((x) => x.deliveries + x.handedIn + x.paidOut > 0)
    .sort((a, b) => b.cashCollected - a.cashCollected);
  const cashOutstanding = riders.reduce((s, r) => s + Math.max(r.cashCollected - r.cashDeposited, 0), 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xl text-white shadow-sm">💵</span>
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Collections</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-neutral-600">
            Cash your riders collect on cash-on-delivery orders, what they hand in, and the delivery fees and payouts, by day or by month.
          </p>
        </div>
      </div>

      {failed ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          Rider settlement isn&apos;t set up in the database yet. Run migration 0041_rider_onboarding_and_settlement.sql first.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-blue-950 p-4 text-white">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Cash still with riders (all time)</p>
              <p className="text-2xl font-extrabold">{money(cashOutstanding)}</p>
            </div>
            <p className="max-w-[55%] text-end text-xs text-white/70">Collected from customers and not yet handed in to FasTrack.</p>
          </div>

          <CollectionsPanel rows={rows} mode={mode} basePath="/admin/collections" money={money} heading="All riders" />

          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="border-b border-neutral-100 px-4 py-3">
              <h2 className="text-sm font-bold text-neutral-800">
                By rider · {current.label}
              </h2>
            </div>
            {perRider.length === 0 ? (
              <p className="p-5 text-sm text-neutral-500">No rider activity in this {mode === "daily" ? "day" : "month"} yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                      <th className="px-4 py-2.5 text-start">Rider</th>
                      <th className="px-3 py-2.5 text-end">Deliveries</th>
                      <th className="px-3 py-2.5 text-end">Collected</th>
                      <th className="px-3 py-2.5 text-end">Handed in</th>
                      <th className="px-3 py-2.5 text-end">Fees</th>
                      <th className="px-4 py-2.5 text-end">Cash with rider</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {perRider.map((x) => (
                      <tr key={x.r.riderId}>
                        <td className="px-4 py-2.5 font-semibold">{x.r.riderName}</td>
                        <td className="px-3 py-2.5 text-end">{x.deliveries}</td>
                        <td className="px-3 py-2.5 text-end font-semibold">{money(x.cashCollected)}</td>
                        <td className="px-3 py-2.5 text-end">{money(x.handedIn)}</td>
                        <td className="px-3 py-2.5 text-end">{money(x.earned)}</td>
                        <td className="px-4 py-2.5 text-end font-bold text-blue-800">{money(Math.max(x.r.cashCollected - x.r.cashDeposited, 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

import Link from "@/components/Link";
import { getRiderSettlementOverview, type RiderSettlementOverviewRow } from "@/lib/rider-settlements";
import { getMoney } from "@/lib/tenant-server";


function Stat({ icon, label, value, accent }: { icon: string; label: string; value: string | number; accent: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg" style={{ background: `${accent}1a`, color: accent }}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-neutral-500">{label}</p>
        <p className="text-2xl font-semibold leading-tight text-neutral-900">{value}</p>
      </div>
    </div>
  );
}

export default async function AdminRiderSettlementsPage() {
  const money = await getMoney();
  let rows: RiderSettlementOverviewRow[] = [];
  let failed = false;
  try {
    rows = await getRiderSettlementOverview();
  } catch {
    failed = true;
  }

  const owedToRiders = rows.filter((r) => r.balance > 0.005).reduce((s, r) => s + r.balance, 0);
  const owedByRiders = rows.filter((r) => r.balance < -0.005).reduce((s, r) => s - r.balance, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paidOut, 0);
  const totalEarned = rows.reduce((s, r) => s + r.earned, 0);

  return (
    <div>
      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xl text-white shadow-sm">🛵</span>
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Rider settlements</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-neutral-600">
            What each rider has earned from delivery fees, the cash they collected on cash-on-delivery orders, and what has been paid or handed in. A
            positive balance is owed to the rider; a negative one is cash the rider still owes FasTrack.
          </p>
        </div>
      </div>

      {failed ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Rider settlement isn&apos;t set up in the database yet — run migration 0041_rider_onboarding_and_settlement.sql first.
        </p>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon="💰" label="Earned by riders (all time)" value={money(totalEarned)} accent="#2563eb" />
            <Stat icon="✅" label="Paid to riders" value={money(totalPaid)} accent="#059669" />
            <Stat icon="⏳" label="We owe riders" value={money(owedToRiders)} accent="#d97706" />
            <Stat icon="💵" label="Riders owe us (cash held)" value={money(owedByRiders)} accent="#dc2626" />
          </div>

          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            {rows.length === 0 ? (
              <p className="p-6 text-sm text-neutral-500">No approved riders yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 text-left text-xs font-medium uppercase tracking-wide text-neutral-400">
                      <th className="px-5 py-2.5">Rider</th>
                      <th className="px-3 py-2.5 text-right">Deliveries</th>
                      <th className="px-3 py-2.5 text-right">Earned</th>
                      <th className="px-3 py-2.5 text-right">Cash collected</th>
                      <th className="px-3 py-2.5 text-right">Paid / handed in</th>
                      <th className="px-3 py-2.5 text-right">Balance</th>
                      <th className="px-5 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {rows.map((r) => (
                      <tr key={r.riderId} className="transition hover:bg-neutral-50">
                        <td className="px-5 py-3">
                          <Link href={`/admin/rider-settlements/${r.riderId}`} className="font-medium text-neutral-900 hover:text-blue-600">
                            {r.riderName}
                          </Link>
                          <div className="text-[11px] text-neutral-400">{r.payoutMethod === "bank" ? "🏦 Bank transfer" : "💵 Cash"}</div>
                        </td>
                        <td className="px-3 py-3 text-right text-neutral-500">{r.deliveredCount}</td>
                        <td className="px-3 py-3 text-right text-neutral-700">{money(r.earned)}</td>
                        <td className="px-3 py-3 text-right text-neutral-500">{money(r.cashCollected)}</td>
                        <td className="px-3 py-3 text-right text-neutral-500">{money(r.paidOut + r.cashDeposited)}</td>
                        <td
                          className={`px-3 py-3 text-right font-semibold ${
                            r.balance > 0.005 ? "text-amber-700" : r.balance < -0.005 ? "text-red-600" : "text-emerald-700"
                          }`}
                        >
                          {r.balance < -0.005 ? `−${money(-r.balance)}` : money(r.balance)}
                          <div className="text-[10px] font-normal">
                            {r.balance > 0.005 ? "we owe rider" : r.balance < -0.005 ? "rider owes us" : "settled"}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link href={`/admin/rider-settlements/${r.riderId}`} className="text-xs font-medium text-blue-600 hover:underline">
                            Ledger
                          </Link>
                        </td>
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

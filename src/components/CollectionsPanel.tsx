import Link from "@/components/Link";
import type { MoneyFormatter } from "@/lib/money";
import type { PeriodMode, PeriodRow } from "@/lib/finance-periods";

function Card({ icon, label, value, hint, tone }: { icon: string; label: string; value: string; hint?: string; tone: "dark" | "light" }) {
  return (
    <div
      className={`rounded-2xl p-4 shadow-sm ${
        tone === "dark" ? "bg-gradient-to-br from-blue-700 to-sky-500 text-white shadow-blue-600/20" : "border border-neutral-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl text-base ${tone === "dark" ? "bg-white/20" : "bg-blue-50"}`}>{icon}</span>
        <p className={`text-xs font-semibold ${tone === "dark" ? "text-white/80" : "text-neutral-500"}`}>{label}</p>
      </div>
      <p className={`mt-2 truncate text-2xl font-extrabold leading-tight ${tone === "dark" ? "" : "text-neutral-900"}`}>{value}</p>
      {hint && <p className={`mt-0.5 text-[11px] ${tone === "dark" ? "text-white/75" : "text-neutral-400"}`}>{hint}</p>}
    </div>
  );
}

/**
 * Daily / monthly collection cards, a collected-versus-handed-in chart and a period table. Used for one rider's own
 * Earnings page and for the admin's all-riders Collections page, so both read the same way.
 */
export default function CollectionsPanel({
  rows,
  mode,
  basePath,
  money,
  heading = "Collections",
  showCharges = false,
}: {
  rows: PeriodRow[];
  mode: PeriodMode;
  basePath: string;
  money: MoneyFormatter;
  heading?: string;
  /** Admin view: also show the delivery charges customers paid. */
  showCharges?: boolean;
}) {
  const current = rows[0];
  const previous = rows[1];
  const unit = mode === "daily" ? "Today" : "This month";
  const prevUnit = mode === "daily" ? "Yesterday" : "Last month";
  const pending = Math.max(current.cashCollected - current.handedIn, 0);
  const chart = [...rows].reverse();
  const max = Math.max(...chart.map((r) => Math.max(r.cashCollected, r.handedIn)), 1);
  const totals = rows.reduce(
    (a, r) => ({
      deliveries: a.deliveries + r.deliveries,
      earned: a.earned + r.earned,
      deliveryCharges: a.deliveryCharges + r.deliveryCharges,
      cashCollected: a.cashCollected + r.cashCollected,
      handedIn: a.handedIn + r.handedIn,
      paidOut: a.paidOut + r.paidOut,
    }),
    { deliveries: 0, earned: 0, deliveryCharges: 0, cashCollected: 0, handedIn: 0, paidOut: 0 }
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold text-neutral-900">{heading}</h2>
        <div className="flex rounded-full bg-neutral-100 p-0.5 text-xs font-bold">
          {(["daily", "monthly"] as const).map((m) => (
            <Link
              key={m}
              href={`${basePath}?view=${m}`}
              scroll={false}
              className={`rounded-full px-3.5 py-1.5 ${mode === m ? "bg-blue-700 text-white shadow" : "text-neutral-500"}`}
            >
              {m === "daily" ? "Daily" : "Monthly"}
            </Link>
          ))}
        </div>
      </div>

      <div className={`grid grid-cols-2 gap-3 ${showCharges ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
        <Card tone="dark" icon="💵" label={`${unit}: cash collected`} value={money(current.cashCollected)} hint={`${previous.label}: ${money(previous.cashCollected)}`} />
        <Card tone="light" icon="🤝" label={`${unit}: handed in`} value={money(current.handedIn)} hint={pending > 0 ? `${money(pending)} still to hand in` : "Nothing pending"} />
        <Card tone="light" icon="🛵" label={`${unit}: rider pay`} value={money(current.earned)} hint={`${current.deliveries} deliveries · ${prevUnit} ${money(previous.earned)}`} />
        {showCharges && (
          <Card tone="light" icon="🧾" label={`${unit}: delivery charges`} value={money(current.deliveryCharges)} hint={`Paid by customers · ${prevUnit} ${money(previous.deliveryCharges)}`} />
        )}
        <Card tone="light" icon="💸" label={`${unit}: paid out`} value={money(current.paidOut)} hint={`${prevUnit} ${money(previous.paidOut)}`} />
      </div>

      {/* chart */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold text-neutral-800">Cash collected vs handed in</p>
          <div className="flex gap-3 text-[11px] font-semibold text-neutral-500">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-blue-700" /> Collected
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-sky-300" /> Handed in
            </span>
          </div>
        </div>
        <div className="flex h-32 items-end gap-1.5 overflow-x-auto">
          {chart.map((r) => (
            <div key={r.key} className="flex h-full min-w-[22px] flex-1 flex-col items-center justify-end gap-1" title={`${r.label}: collected ${money(r.cashCollected)}, handed in ${money(r.handedIn)}`}>
              <div className="flex h-full w-full items-end gap-0.5">
                <div className="w-1/2 rounded-t bg-blue-700" style={{ height: `${Math.max((r.cashCollected / max) * 100, r.cashCollected > 0 ? 4 : 1)}%` }} />
                <div className="w-1/2 rounded-t bg-sky-300" style={{ height: `${Math.max((r.handedIn / max) * 100, r.handedIn > 0 ? 4 : 1)}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1.5 overflow-hidden">
          {chart.map((r) => (
            <span key={r.key} className="min-w-[22px] flex-1 truncate text-center text-[9px] font-medium text-neutral-400">
              {mode === "daily" ? r.label.split(" ").slice(0, 2).join(" ") : r.label.split(" ")[0]}
            </span>
          ))}
        </div>
      </div>

      {/* table */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-start text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                <th className="px-4 py-2.5 text-start">{mode === "daily" ? "Day" : "Month"}</th>
                <th className="px-3 py-2.5 text-end">Deliveries</th>
                <th className="px-3 py-2.5 text-end">Collected</th>
                <th className="px-3 py-2.5 text-end">Handed in</th>
                {showCharges && <th className="px-3 py-2.5 text-end">Delivery charges</th>}
                <th className="px-3 py-2.5 text-end">Rider pay</th>
                <th className="px-4 py-2.5 text-end">Paid out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((r) => (
                <tr key={r.key} className={r.deliveries + r.handedIn + r.paidOut === 0 ? "text-neutral-300" : ""}>
                  <td className="px-4 py-2.5 font-semibold">{r.label}</td>
                  <td className="px-3 py-2.5 text-end">{r.deliveries}</td>
                  <td className="px-3 py-2.5 text-end font-semibold">{money(r.cashCollected)}</td>
                  <td className="px-3 py-2.5 text-end">{money(r.handedIn)}</td>
                  {showCharges && <td className="px-3 py-2.5 text-end">{money(r.deliveryCharges)}</td>}
                  <td className="px-3 py-2.5 text-end">{money(r.earned)}</td>
                  <td className="px-4 py-2.5 text-end">{money(r.paidOut)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-200 bg-neutral-50 text-sm font-extrabold">
                <td className="px-4 py-2.5">Total</td>
                <td className="px-3 py-2.5 text-end">{totals.deliveries}</td>
                <td className="px-3 py-2.5 text-end">{money(totals.cashCollected)}</td>
                <td className="px-3 py-2.5 text-end">{money(totals.handedIn)}</td>
                {showCharges && <td className="px-3 py-2.5 text-end">{money(totals.deliveryCharges)}</td>}
                <td className="px-3 py-2.5 text-end">{money(totals.earned)}</td>
                <td className="px-4 py-2.5 text-end">{money(totals.paidOut)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
}

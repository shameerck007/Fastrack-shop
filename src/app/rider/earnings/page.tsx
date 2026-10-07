import Link from "@/components/Link";
import RiderEarningsChart from "@/components/rider/RiderEarningsChart";
import { getRiderWallet, formatWhen, earningsByDay } from "@/lib/rider-wallet";
import { getMoney } from "@/lib/tenant-server";
import CollectionsPanel from "@/components/CollectionsPanel";
import { buildPeriods, type PeriodMode } from "@/lib/finance-periods";

export const metadata = { title: "Earnings · FasTrack Rider" };

const noT = (k: string) => (k === "rider.this_week" ? "Last 7 days" : k);

function Row({ sign, label, hint, amount, width, color }: { sign: string; label: string; hint: string; amount: string; width: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white" style={{ background: color }}>
            {sign}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-neutral-900">{label}</p>
            <p className="truncate text-xs text-neutral-500">{hint}</p>
          </div>
        </div>
        <span className="shrink-0 font-bold text-neutral-900">{amount}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-100">
        <div className="h-full rounded-full" style={{ width: `${Math.max(width, 2)}%`, background: color }} />
      </div>
    </div>
  );
}

export default async function RiderEarningsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const mode: PeriodMode = view === "monthly" ? "monthly" : "daily";
  const money = await getMoney();
  const wallet = await getRiderWallet();

  if (!wallet) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
        Your earnings will appear here after your first delivery.
      </div>
    );
  }

  const { summary: s, orders, entries, cashInHand, timeZone } = wallet;
  const owed = s.balance >= 0;
  const week = earningsByDay(orders, timeZone, 7);
  const month = earningsByDay(orders, timeZone, 30);
  const sum = (rows: { earnings: number; deliveries: number }[]) => ({
    earnings: rows.reduce((a, r) => a + r.earnings, 0),
    deliveries: rows.reduce((a, r) => a + r.deliveries, 0),
  });
  const today = week[week.length - 1];
  const periods = [
    { label: "Today", ...sum([today]) },
    { label: "7 days", ...sum(week) },
    { label: "30 days", ...sum(month) },
    { label: "All time", earnings: s.earned, deliveries: s.deliveredCount },
  ];
  const biggest = Math.max(s.earned, s.cashCollected, s.paidOut, s.cashDeposited, 1);
  const pct = (n: number) => (n / biggest) * 100;
  const depositedPct = s.cashCollected > 0 ? Math.min((s.cashDeposited / s.cashCollected) * 100, 100) : 100;

  return (
    <div className="flex flex-col gap-4">
      {/* balance */}
      <div
        className={`overflow-hidden rounded-3xl p-5 text-white shadow-lg ${
          owed ? "bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 shadow-blue-600/25" : "bg-gradient-to-br from-blue-950 via-blue-900 to-blue-700 shadow-blue-900/30"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-white/80">{owed ? "FasTrack owes you" : "⚠ You owe FasTrack"}</p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight">{money(Math.abs(s.balance))}</p>
        <p className="mt-2 text-sm text-white/85">
          {owed
            ? s.balance === 0
              ? "You are all settled up."
              : "This is paid to you in the next payout."
            : "You are holding customer cash. Hand it in to FasTrack to clear this."}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-2xl bg-white/15 p-3">
            <p className="text-white/75">Total earned</p>
            <p className="text-lg font-extrabold">{money(s.earned)}</p>
          </div>
          <div className="rounded-2xl bg-white/15 p-3">
            <p className="text-white/75">Paid to you</p>
            <p className="text-lg font-extrabold">{money(s.paidOut)}</p>
          </div>
        </div>
      </div>

      {/* periods */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {periods.map((p) => (
          <div key={p.label} className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{p.label}</p>
            <p className="mt-0.5 text-lg font-extrabold text-neutral-900">{money(p.earnings)}</p>
            <p className="text-xs text-neutral-500">
              {p.deliveries} {p.deliveries === 1 ? "delivery" : "deliveries"}
            </p>
          </div>
        ))}
      </div>

      <CollectionsPanel rows={buildPeriods(orders, entries, mode, timeZone)} mode={mode} basePath="/rider/earnings" money={money} heading="My collections" />

      <RiderEarningsChart days={week} t={noT} money={money} />

      {/* how the balance is made */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-neutral-800">How your balance adds up</h2>
        <p className="mb-4 mt-0.5 text-xs text-neutral-500">
          Nothing hidden: every number below comes from your delivered orders and the payments recorded by FasTrack.
        </p>
        <div className="flex flex-col gap-4">
          <Row sign="+" label="Delivery fees earned" hint={`${s.deliveredCount} delivered orders`} amount={money(s.earned)} width={pct(s.earned)} color="#1d4ed8" />
          <Row sign="−" label="Cash you collected" hint="Cash-on-delivery money you took from customers" amount={money(s.cashCollected)} width={pct(s.cashCollected)} color="#38bdf8" />
          <Row sign="+" label="Cash you handed in" hint="Deposits recorded by FasTrack" amount={money(s.cashDeposited)} width={pct(s.cashDeposited)} color="#0369a1" />
          <Row sign="−" label="Payouts you received" hint="Bank or cash payments from FasTrack" amount={money(s.paidOut)} width={pct(s.paidOut)} color="#1e3a8a" />
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-neutral-50 px-3 py-2.5 text-sm">
          <span className="font-semibold text-neutral-700">= Balance</span>
          <span className={`font-extrabold ${owed ? "text-blue-700" : "text-blue-900"}`}>
            {owed ? "" : "−"}
            {money(Math.abs(s.balance))}
          </span>
        </div>
      </div>

      {/* cash in hand */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-neutral-800">💵 Cash in your hand</h2>
          <span className={`text-lg font-extrabold ${cashInHand > 0 ? "text-blue-900" : "text-blue-700"}`}>{money(cashInHand)}</span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-sky-100">
          <div className="h-full rounded-full bg-blue-600" style={{ width: `${depositedPct}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-neutral-500">
          <span>Handed in {money(s.cashDeposited)}</span>
          <span>Collected {money(s.cashCollected)}</span>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          {cashInHand > 0
            ? "Hand this cash to FasTrack at your next visit. It is taken off your balance until you do."
            : "No customer cash to hand in right now."}
        </p>
      </div>

      {/* payments */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-neutral-800">Payments and cash handed in</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-neutral-500">No payments yet. Once FasTrack pays you, it shows up here with the date and reference.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base ${e.kind === "payout" ? "bg-blue-100" : "bg-sky-100"}`}>
                    {e.kind === "payout" ? "💸" : "🤝"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900">{e.kind === "payout" ? "Payout received" : "Cash handed in"}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {formatWhen(e.createdAt, timeZone)} · {e.method}
                      {e.reference ? ` · Ref ${e.reference}` : ""}
                      {e.note ? ` · ${e.note}` : ""}
                    </p>
                  </div>
                </div>
                <span className={`shrink-0 text-sm font-bold ${e.kind === "payout" ? "text-blue-800" : "text-sky-700"}`}>{money(e.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* recent trips */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-neutral-800">Recent deliveries</h2>
          <Link href="/rider/history" className="text-xs font-bold text-blue-700">
            See all →
          </Link>
        </div>
        {orders.length === 0 ? (
          <p className="text-sm text-neutral-500">No delivered orders yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {orders.slice(0, 5).map((o) => (
              <li key={o.orderId} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-semibold text-neutral-900">#{o.orderNumber}</p>
                  <p className="text-xs text-neutral-500">{formatWhen(o.deliveredAt, timeZone)}</p>
                </div>
                <span className="font-bold text-blue-700">+{money(o.deliveryFee)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

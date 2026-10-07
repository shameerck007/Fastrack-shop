import type { RiderSettlementEntry, RiderSettlementOrder } from "@/lib/rider-settlements";

export type PeriodMode = "daily" | "monthly";

export interface PeriodRow {
  key: string;
  label: string;
  deliveries: number;
  /** Delivery fees earned by riders. */
  earned: number;
  /** Cash taken from customers on cash-on-delivery orders. */
  cashCollected: number;
  /** Cash riders handed in to FasTrack. */
  handedIn: number;
  /** Money FasTrack paid out to riders. */
  paidOut: number;
}

function dayKey(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(d); // YYYY-MM-DD
}

/**
 * Group orders and ledger entries into the last N days or months (newest first), in the market's own time zone,
 * so a delivery at 11:30 pm India time lands on the right day.
 */
export function buildPeriods(
  orders: Pick<RiderSettlementOrder, "deliveredAt" | "deliveryFee" | "cashCollected">[],
  entries: Pick<RiderSettlementEntry, "kind" | "amount" | "createdAt">[],
  mode: PeriodMode,
  timeZone: string,
  count = mode === "daily" ? 14 : 12
): PeriodRow[] {
  const keyOf = (iso: string) => (mode === "daily" ? dayKey(new Date(iso), timeZone) : dayKey(new Date(iso), timeZone).slice(0, 7));
  const rows = new Map<string, PeriodRow>();
  const now = new Date();
  for (let i = 0; i < count; i++) {
    let d: Date;
    if (mode === "daily") {
      d = new Date(now.getTime() - i * 86400000);
    } else {
      const [y, m] = dayKey(now, timeZone).split("-").map(Number);
      d = new Date(Date.UTC(y, m - 1 - i, 15));
    }
    const key = mode === "daily" ? dayKey(d, timeZone) : d.toISOString().slice(0, 7);
    const label =
      mode === "daily"
        ? d.toLocaleDateString("en-GB", { timeZone, weekday: "short", day: "numeric", month: "short" })
        : d.toLocaleDateString("en-GB", { timeZone: "UTC", month: "short", year: "numeric" });
    rows.set(key, { key, label, deliveries: 0, earned: 0, cashCollected: 0, handedIn: 0, paidOut: 0 });
  }
  for (const o of orders) {
    if (!o.deliveredAt) continue;
    const row = rows.get(keyOf(o.deliveredAt));
    if (!row) continue;
    row.deliveries += 1;
    row.earned += o.deliveryFee;
    row.cashCollected += o.cashCollected;
  }
  for (const e of entries) {
    const row = rows.get(keyOf(e.createdAt));
    if (!row) continue;
    if (e.kind === "payout") row.paidOut += e.amount;
    else row.handedIn += e.amount;
  }
  return [...rows.values()];
}

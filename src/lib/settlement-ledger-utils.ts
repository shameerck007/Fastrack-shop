/** Pure helpers for the settlement ledger. Safe to import from client components (no server code). */
import type { LedgerEntry, MonthlyPoint } from "@/lib/settlements";

/** Monthly figures for one store, worked out from its ledger entries. */
export function monthlyFromLedger(entries: LedgerEntry[]): MonthlyPoint[] {
  const by = new Map<string, MonthlyPoint>();
  for (const e of entries) {
    if (!e.at) continue;
    const month = `${e.at.slice(0, 7)}-01`;
    const m = by.get(month) ?? { month, gross: 0, commission: 0, discount: 0, refunds: 0, net: 0, paidOut: 0 };
    if (e.kind === "payout") m.paidOut += -e.amount;
    else {
      m.net += e.amount;
      if (e.kind === "sale") {
        m.gross += e.gross;
        m.commission += e.commission;
        m.discount += e.discount;
      } else {
        m.refunds += -e.gross;
        m.commission += e.commission;
        m.discount += e.discount;
      }
    }
    by.set(month, m);
  }
  return [...by.values()].sort((a, b) => a.month.localeCompare(b.month));
}

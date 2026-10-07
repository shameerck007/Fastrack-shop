import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant-server";
import {
  getRiderSettlementSummary,
  getRiderSettlementOrders,
  getRiderSettlementEntries,
  type RiderSettlementSummary,
  type RiderSettlementOrder,
  type RiderSettlementEntry,
} from "@/lib/rider-settlements";

export interface RiderWallet {
  riderId: string;
  summary: RiderSettlementSummary;
  orders: RiderSettlementOrder[];
  entries: RiderSettlementEntry[];
  /** Cash taken from customers that hasn't been handed in yet. */
  cashInHand: number;
  timeZone: string;
}

/** Everything the rider's Earnings and Trips pages show: the settlement balance, per-order lines and payment history. */
export async function getRiderWallet(): Promise<RiderWallet | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [summary, orders, entries, tenant] = await Promise.all([
    getRiderSettlementSummary(user.id).catch(() => null),
    getRiderSettlementOrders(user.id).catch(() => []),
    getRiderSettlementEntries(user.id).catch(() => []),
    getCurrentTenant().catch(() => null),
  ]);
  if (!summary) return null;
  return {
    riderId: user.id,
    summary,
    orders,
    entries,
    cashInHand: Math.max(summary.cashCollected - summary.cashDeposited, 0),
    timeZone: tenant?.country_code === "IN" ? "Asia/Kolkata" : "Asia/Riyadh",
  };
}

export function formatWhen(iso: string | null, timeZone: string, withTime = true): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

/** Earnings per calendar day in the market's own time zone, for orders already loaded. */
export function earningsByDay(orders: RiderSettlementOrder[], timeZone: string, days: number) {
  const fmt = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(d);
  const out: { date: string; label: string; earnings: number; deliveries: number }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    out.push({
      date: fmt(d),
      label: d.toLocaleDateString("en-US", { timeZone, weekday: "short" }),
      earnings: 0,
      deliveries: 0,
    });
  }
  for (const o of orders) {
    if (!o.deliveredAt) continue;
    const row = out.find((r) => r.date === fmt(new Date(o.deliveredAt as string)));
    if (row) {
      row.earnings += o.deliveryFee;
      row.deliveries += 1;
    }
  }
  return out;
}

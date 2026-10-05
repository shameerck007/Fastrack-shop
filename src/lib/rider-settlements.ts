import { createClient } from "@/lib/supabase/server";
import type { RiderStatus } from "@/types/database";

// The settlement RPCs/tables arrive with migration 0041 and aren't in the
// generated Database type, so they're called through a loose handle.
type Result = Promise<{ data: unknown; error: { message: string } | null }>;
type Loose = {
  rpc: (fn: string, args?: object) => Result;
  from: (table: string) => {
    select: (cols: string) => { eq: (col: string, v: string) => { order: (col: string, o: object) => Result } };
  };
};

async function loose(): Promise<Loose> {
  return (await createClient()) as unknown as Loose;
}

export interface RiderSettlementSummary {
  deliveredCount: number;
  earned: number;
  cashCollected: number;
  paidOut: number;
  cashDeposited: number;
  /** Positive: FasTrack owes the rider. Negative: the rider owes FasTrack. */
  balance: number;
}

export async function getRiderSettlementSummary(riderId: string): Promise<RiderSettlementSummary | null> {
  const db = await loose();
  const { data, error } = await db.rpc("rider_settlement_summary", { target_rider_id: riderId });
  if (error) throw new Error(error.message);
  const r = (data as Record<string, number>[] | null)?.[0];
  if (!r) return null;
  return {
    deliveredCount: Number(r.delivered_count),
    earned: Number(r.earned),
    cashCollected: Number(r.cash_collected),
    paidOut: Number(r.paid_out),
    cashDeposited: Number(r.cash_deposited),
    balance: Number(r.balance),
  };
}

export interface RiderSettlementOrder {
  orderId: string;
  orderNumber: string;
  deliveredAt: string | null;
  deliveryFee: number;
  orderTotal: number;
  cashCollected: number;
}

export async function getRiderSettlementOrders(riderId: string): Promise<RiderSettlementOrder[]> {
  const db = await loose();
  const { data, error } = await db.rpc("rider_settlement_orders", { target_rider_id: riderId });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, string | number | null>[]).map((r) => ({
    orderId: String(r.order_id),
    orderNumber: String(r.order_number),
    deliveredAt: (r.delivered_at as string | null) ?? null,
    deliveryFee: Number(r.delivery_fee),
    orderTotal: Number(r.order_total),
    cashCollected: Number(r.cash_collected),
  }));
}

export interface RiderSettlementEntry {
  id: string;
  kind: "payout" | "cash_deposit";
  amount: number;
  method: string;
  reference: string | null;
  note: string | null;
  createdAt: string;
}

export async function getRiderSettlementEntries(riderId: string): Promise<RiderSettlementEntry[]> {
  const db = await loose();
  const { data, error } = await db
    .from("rider_settlement_entries")
    .select("id, kind, amount, method, reference, note, created_at")
    .eq("rider_id", riderId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, string | number | null>[]).map((r) => ({
    id: String(r.id),
    kind: r.kind as RiderSettlementEntry["kind"],
    amount: Number(r.amount),
    method: String(r.method),
    reference: (r.reference as string | null) ?? null,
    note: (r.note as string | null) ?? null,
    createdAt: String(r.created_at),
  }));
}

export interface RiderSettlementOverviewRow extends RiderSettlementSummary {
  riderId: string;
  riderName: string;
  riderStatus: RiderStatus;
  payoutMethod: "bank" | "cash";
}

export async function getRiderSettlementOverview(): Promise<RiderSettlementOverviewRow[]> {
  const db = await loose();
  const { data, error } = await db.rpc("admin_rider_settlement_overview");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, string | number>[]).map((r) => ({
    riderId: String(r.rider_id),
    riderName: String(r.rider_name),
    riderStatus: r.rider_status as RiderStatus,
    payoutMethod: r.payout_method as "bank" | "cash",
    deliveredCount: Number(r.delivered_count),
    earned: Number(r.earned),
    cashCollected: Number(r.cash_collected),
    paidOut: Number(r.paid_out),
    cashDeposited: Number(r.cash_deposited),
    balance: Number(r.balance),
  }));
}

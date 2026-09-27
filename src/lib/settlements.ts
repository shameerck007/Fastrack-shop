import { createClient } from "@/lib/supabase/server";
import type { StoreStatus } from "@/types/database";

export interface SettlementSummary {
  grossSales: number;
  commissionRate: number;
  commissionAmount: number;
  netEarned: number;
  paidOut: number;
  balanceDue: number;
  deliveredOrderCount: number;
}

function toSummary(row: {
  gross_sales: number;
  commission_rate: number;
  commission_amount: number;
  net_earned: number;
  paid_out: number;
  balance_due: number;
  delivered_order_count: number;
}): SettlementSummary {
  return {
    grossSales: row.gross_sales,
    commissionRate: row.commission_rate,
    commissionAmount: row.commission_amount,
    netEarned: row.net_earned,
    paidOut: row.paid_out,
    balanceDue: row.balance_due,
    deliveredOrderCount: row.delivered_order_count,
  };
}

/** One store's settlement summary — works for an admin (any store) or a merchant (their own). */
export async function getStoreSettlementSummary(storeId: string): Promise<SettlementSummary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("store_settlement_summary", { target_store_id: storeId }).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return toSummary(data);
}

export interface SettlementOrderRow {
  orderId: string;
  orderNumber: string;
  deliveredAt: string | null;
  itemCount: number;
  lineTotal: number;
  commissionAmount: number;
  netAmount: number;
}

/** Order-level breakdown behind a store's summary — same access rule as getStoreSettlementSummary. */
export async function getStoreSettlementOrders(storeId: string): Promise<SettlementOrderRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("store_settlement_orders", { target_store_id: storeId });
  if (error) throw error;
  return ((data ?? []) as {
    order_id: string;
    order_number: string;
    delivered_at: string | null;
    item_count: number;
    line_total: number;
    commission_amount: number;
    net_amount: number;
  }[]).map((r) => ({
    orderId: r.order_id,
    orderNumber: r.order_number,
    deliveredAt: r.delivered_at,
    itemCount: r.item_count,
    lineTotal: r.line_total,
    commissionAmount: r.commission_amount,
    netAmount: r.net_amount,
  }));
}

export interface SettlementPayout {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  note: string | null;
  createdAt: string;
}

/** A store's payout history — an admin sees any store's, a merchant only their own (RLS-scoped). */
export async function getStorePayouts(storeId: string): Promise<SettlementPayout[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("settlement_payouts")
    .select("id, amount, method, reference, note, created_at")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as { id: string; amount: number; method: string; reference: string | null; note: string | null; created_at: string }[]).map(
    (r) => ({ id: r.id, amount: r.amount, method: r.method, reference: r.reference, note: r.note, createdAt: r.created_at })
  );
}

export interface AdminSettlementOverviewRow extends SettlementSummary {
  storeId: string;
  storeName: string;
  storeStatus: StoreStatus;
}

/** Every store's settlement summary in one call, admin-only — the ledger's landing list. */
export async function getAdminSettlementOverview(): Promise<AdminSettlementOverviewRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_settlement_overview");
  if (error) throw error;
  return ((data ?? []) as {
    store_id: string;
    store_name: string;
    store_status: StoreStatus;
    gross_sales: number;
    commission_rate: number;
    commission_amount: number;
    net_earned: number;
    paid_out: number;
    balance_due: number;
    delivered_order_count: number;
  }[]).map((r) => ({
    storeId: r.store_id,
    storeName: r.store_name,
    storeStatus: r.store_status,
    ...toSummary(r),
  }));
}

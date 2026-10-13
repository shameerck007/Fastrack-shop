import Link from "@/components/Link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStoreSettlementSummary, getStoreSettlementOrders, getStorePayouts, getStoreLedger } from "@/lib/settlements";
import LedgerWorkspace from "@/components/settlement/LedgerWorkspace";
import RecordPayoutForm from "@/components/admin/RecordPayoutForm";
import StatementDialog from "@/components/StatementDialog";

export const metadata = { title: "Supplier ledger" };

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-600",
  suspended: "bg-neutral-100 text-neutral-500",
};

export default async function AdminSettlementDetailPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const supabase = await createClient();
  const { data: store } = await supabase.from("stores").select("id, name, status, city").eq("id", storeId).maybeSingle();
  if (!store) notFound();

  const [summary, orders, payouts, entries] = await Promise.all([getStoreSettlementSummary(storeId), getStoreSettlementOrders(storeId), getStorePayouts(storeId), getStoreLedger(storeId)]);
  if (!summary) notFound();

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <Link href="/admin/settlements" className="text-blue-600 hover:underline">
          ← All suppliers
        </Link>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[store.status] ?? "bg-neutral-100"}`}>{store.status}</span>
        {store.city && <span className="text-neutral-500">{store.city}</span>}
        <Link href="/admin/commission" className="text-neutral-500 hover:text-blue-600 hover:underline">
          Commission rates →
        </Link>
        <Link href={`/admin/merchants/${store.id}`} className="text-neutral-500 hover:text-blue-600 hover:underline">
          Supplier profile →
        </Link>
      </div>
      <LedgerWorkspace
        storeId={store.id}
        storeName={store.name}
        role="admin"
        summary={summary}
        entries={entries}
        orders={orders}
        payouts={payouts}
        headerActions={
          <>
            <StatementDialog storeId={store.id} />
            <RecordPayoutForm storeId={store.id} balanceDue={summary.balanceDue} />
          </>
        }
      />
    </div>
  );
}

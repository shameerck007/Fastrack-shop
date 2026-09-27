import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStoreSettlementSummary, getStoreSettlementOrders, getStorePayouts } from "@/lib/settlements";
import { SettlementSummaryCards, SettlementOrdersTable, SettlementPayoutsList } from "@/components/SettlementLedger";
import CommissionRateEditor from "@/components/admin/CommissionRateEditor";
import RecordPayoutForm from "@/components/admin/RecordPayoutForm";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-600",
  suspended: "bg-neutral-100 text-neutral-500",
};

export default async function AdminSettlementDetailPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const supabase = await createClient();

  const { data: store } = await supabase.from("stores").select("id, name, status, commission_rate").eq("id", storeId).maybeSingle();
  if (!store) notFound();

  const [summary, orders, payouts] = await Promise.all([
    getStoreSettlementSummary(storeId),
    getStoreSettlementOrders(storeId),
    getStorePayouts(storeId),
  ]);

  return (
    <div>
      <Link href="/admin/settlements" className="text-sm text-blue-600 hover:underline">
        ← Settlement ledger
      </Link>

      <div className="mb-5 mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{store.name}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[store.status] ?? "bg-neutral-100"}`}>
              {store.status}
            </span>
          </div>
          <div className="mt-0.5">
            <CommissionRateEditor storeId={store.id} rate={store.commission_rate} />
          </div>
        </div>
        {summary && <RecordPayoutForm storeId={store.id} balanceDue={summary.balanceDue} />}
      </div>

      {summary && (
        <div className="mb-5">
          <SettlementSummaryCards summary={summary} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <h2 className="border-b border-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-700">
              Delivered orders ({orders.length})
            </h2>
            <SettlementOrdersTable orders={orders} />
          </section>
        </div>

        <div>
          <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <h2 className="border-b border-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-700">
              Payout history ({payouts.length})
            </h2>
            <SettlementPayoutsList payouts={payouts} />
          </section>
        </div>
      </div>
    </div>
  );
}

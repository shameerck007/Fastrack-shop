import { redirect } from "next/navigation";
import { getMyStore } from "@/lib/merchant";
import { getStoreSettlementSummary, getStoreSettlementOrders, getStorePayouts } from "@/lib/settlements";
import { SettlementSummaryCards, SettlementOrdersTable, SettlementPayoutsList } from "@/components/SettlementLedger";

export default async function MerchantSettlementsPage() {
  const store = await getMyStore();
  if (!store) redirect("/merchant");

  const [summary, orders, payouts] = await Promise.all([
    getStoreSettlementSummary(store.id),
    getStoreSettlementOrders(store.id),
    getStorePayouts(store.id),
  ]);

  return (
    <div>
      <h1 className="text-xl font-semibold">Settlement ledger</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Your earnings from delivered orders, FasTrack&apos;s commission, and what&apos;s been paid out to you so far.
      </p>

      {summary && (
        <div className="my-5">
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

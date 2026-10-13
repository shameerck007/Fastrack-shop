import { redirect } from "next/navigation";
import { getMyStore } from "@/lib/merchant";
import { getStoreSettlementSummary, getStoreSettlementOrders, getStorePayouts, getStoreLedger } from "@/lib/settlements";
import LedgerWorkspace from "@/components/settlement/LedgerWorkspace";

export const metadata = { title: "Supplier ledger" };

export default async function MerchantSettlementsPage() {
  const store = await getMyStore();
  if (!store) redirect("/merchant");

  const [summary, orders, payouts, entries] = await Promise.all([
    getStoreSettlementSummary(store.id),
    getStoreSettlementOrders(store.id),
    getStorePayouts(store.id),
    getStoreLedger(store.id),
  ]);
  if (!summary) redirect("/merchant");

  return <LedgerWorkspace storeId={store.id} storeName={store.name} role="merchant" summary={summary} entries={entries} orders={orders} payouts={payouts} />;
}

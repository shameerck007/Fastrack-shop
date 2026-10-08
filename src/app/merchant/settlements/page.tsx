import { redirect } from "next/navigation";
import { getMoney } from "@/lib/tenant-server";
import { PageHeader } from "@/components/admin/AdminUi";
import { getMyStore } from "@/lib/merchant";
import { getStoreSettlementSummary, getStoreSettlementOrders, getStorePayouts } from "@/lib/settlements";
import { SettlementSummaryCards, SettlementOrdersTable, SettlementPayoutsList } from "@/components/SettlementLedger";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

export default async function MerchantSettlementsPage() {
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const money = await getMoney();
  const store = await getMyStore();
  if (!store) redirect("/merchant");

  const [summary, orders, payouts] = await Promise.all([
    getStoreSettlementSummary(store.id),
    getStoreSettlementOrders(store.id),
    getStorePayouts(store.id),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader icon="📒" title={t("merchant.settlement_ledger")} subtitle={t("merchant.settlement_intro")} />

      {summary && (
        <div>
          <SettlementSummaryCards summary={summary} t={t} money={money} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <h2 className="border-b border-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-700">
              {t("merchant.delivered_orders_count", { count: orders.length })}
            </h2>
            <SettlementOrdersTable orders={orders} t={t} locale={locale} money={money} />
          </section>
        </div>

        <div>
          <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <h2 className="border-b border-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-700">
              {t("merchant.payout_history_count", { count: payouts.length })}
            </h2>
            <SettlementPayoutsList payouts={payouts} t={t} locale={locale} money={money} />
          </section>
        </div>
      </div>
    </div>
  );
}

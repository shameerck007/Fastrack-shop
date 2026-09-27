import Link from "next/link";
import { getMyOrders } from "@/lib/orders";
import { formatSAR } from "@/lib/utils";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

export default async function OrdersPage() {
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const orders = await getMyOrders();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">{t("orders.title")}</h1>

      {orders.length === 0 ? (
        <p className="text-sm text-neutral-500">
          {t("orders.no_orders")}. <Link href="/" className="text-blue-600 hover:underline">{t("cart.start_shopping")}</Link>.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 hover:shadow-sm"
            >
              <div>
                <p className="font-medium">{t("orders.order_hash", { number: order.order_number })}</p>
                <p className="text-sm text-neutral-500">
                  {new Date(order.created_at).toLocaleString(locale === "ar" ? "ar-SA" : "en-US")}
                </p>
              </div>
              <div className="text-end">
                <p className="font-medium">{formatSAR(order.total)}</p>
                <p className="text-sm text-blue-600">{t(`order_status.${order.status}`)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import DeliveryProgressStepper from "@/components/rider/DeliveryProgressStepper";
import { formatSAR } from "@/lib/utils";
import type { ActiveDelivery } from "@/lib/rider";
import type { OrderStatus } from "@/types/database";

export default function ActiveDeliveryCard({
  delivery,
  t,
}: {
  delivery: ActiveDelivery;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
      <div className="flex items-center justify-between bg-blue-50 px-4 py-3">
        <h2 className="text-sm font-semibold text-blue-900">{t("rider.active_delivery")}</h2>
        <span className="text-sm font-semibold text-blue-700">{formatSAR(delivery.delivery_fee)}</span>
      </div>

      <div className="px-4 pt-4">
        <DeliveryProgressStepper status={delivery.status as OrderStatus} t={t} />
      </div>

      <div className="flex items-center justify-between px-4 py-4 text-sm">
        <div>
          <p className="font-medium text-neutral-900">#{delivery.order_number}</p>
          <p className="text-neutral-500">
            {t("rider.items_count", { count: delivery.item_count, plural: delivery.item_count === 1 ? "" : "s" })}
          </p>
        </div>
        {delivery.warehouses && (
          <p className="max-w-[45%] truncate text-end text-neutral-600">📍 {delivery.warehouses.name}</p>
        )}
      </div>

      <Link
        href={`/rider/orders/${delivery.id}`}
        className="block border-t border-neutral-100 px-4 py-3 text-center text-sm font-semibold text-blue-700 hover:bg-blue-50"
      >
        {t("rider.view_delivery")}
      </Link>
    </div>
  );
}

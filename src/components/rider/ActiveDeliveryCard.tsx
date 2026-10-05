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
    <div className="overflow-hidden rounded-3xl border border-blue-200 bg-white shadow-lg shadow-blue-600/10">
      <div className="flex items-center justify-between bg-gradient-to-r from-blue-700 to-blue-500 px-4 py-3 text-white">
        <h2 className="flex items-center gap-2 text-sm font-bold"><span className="h-2 w-2 animate-pulse rounded-full bg-white" />{t("rider.active_delivery")}</h2>
        <span className="rounded-full bg-white/20 px-3 py-0.5 text-sm font-extrabold">{formatSAR(delivery.delivery_fee)}</span>
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
        className="mx-4 mb-4 flex h-11 items-center justify-center rounded-full bg-blue-700 text-sm font-extrabold text-white shadow-md shadow-blue-700/25 active:scale-95"
      >
        {t("rider.view_delivery")}
      </Link>
    </div>
  );
}

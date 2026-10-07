import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DeliveryActions from "@/components/rider/DeliveryActions";
import DeliveryProgressStepper from "@/components/rider/DeliveryProgressStepper";
import RiderLocationTracker from "@/components/rider/RiderLocationTracker";
import RiderTaskMap from "@/components/rider/RiderTaskMap";
import OrderChat from "@/components/OrderChat";
import { getOrderMessages } from "@/lib/order-messages";

import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import { getMoney } from "@/lib/tenant-server";

interface Place {
  lat: number | null;
  lng: number | null;
}

/** Turn-by-turn in the rider's own maps app: exact coordinates when we have them, otherwise the address text. */
function directionsUrl(place: Place, fallbackText: string) {
  const destination = place.lat != null && place.lng != null ? `${place.lat},${place.lng}` : fallbackText;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

function StopCard({
  active,
  label,
  title,
  lines,
  children,
}: {
  active: boolean;
  label: string;
  title: string;
  lines: (string | null | undefined | false)[];
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${active ? "border-blue-300 bg-blue-50 ring-2 ring-blue-100" : "border-neutral-200 bg-white"}`}>
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${active ? "bg-blue-700 text-white" : "bg-neutral-100 text-neutral-500"}`}>
          {label}
        </span>
      </div>
      <p className="mt-2 font-bold text-neutral-900">{title}</p>
      {lines.filter(Boolean).map((l, i) => (
        <p key={i} className="text-sm text-neutral-600">
          {l}
        </p>
      ))}
      <div className="mt-3 flex gap-2">{children}</div>
    </div>
  );
}

const actionBtn =
  "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-bold active:scale-95 transition";

export default async function RiderOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const money = await getMoney();
  const { id } = await params;
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "*, order_items(*), addresses(address_line, label, receiver_name, receiver_phone, building_number, unit_number, lat, lng), warehouses(name, address_line, lat, lng), profiles(full_name, phone), payments(method, status)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!order) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPickupStage = ["rider_assigned", "ready_for_pickup", "preparing"].includes(order.status);
  const isTrackable = ["rider_assigned", "out_for_delivery"].includes(order.status);
  const isActive = !["delivered", "cancelled"].includes(order.status);
  const messages = user ? await getOrderMessages(order.id) : [];

  const payment = (order.payments as { method: string; status: string }[] | null)?.[0];
  const collectCash = payment?.method === "cash_on_delivery" && payment.status !== "refunded";
  const customerPhone = order.addresses?.receiver_phone || order.profiles?.phone || null;
  const itemCount = order.order_items.length;

  return (
    <div className="pb-48">
      {isTrackable && <RiderLocationTracker />}

      {/* summary */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">{t("orders.order_hash", { number: order.order_number })}</h1>
          {isActive && (
            <p className="text-sm font-semibold text-blue-700">{isPickupStage ? t("rider_task.next_pickup") : t("rider_task.next_dropoff")}</p>
          )}
        </div>
        <div className="rounded-2xl bg-blue-700 px-4 py-2 text-end text-white shadow-md shadow-blue-700/20">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-100">{t("rider_task.you_earn")}</p>
          <p className="text-lg font-extrabold leading-tight">{money(order.delivery_fee)}</p>
        </div>
      </div>

      {isActive && (
        <div className="mb-4">
          <RiderTaskMap
            shop={order.warehouses?.lat != null && order.warehouses?.lng != null ? { lat: order.warehouses.lat, lng: order.warehouses.lng } : null}
            dest={order.addresses?.lat != null && order.addresses?.lng != null ? { lat: order.addresses.lat, lng: order.addresses.lng } : null}
            stage={isPickupStage ? "pickup" : "dropoff"}
          />
        </div>
      )}

      {/* cash to collect */}
      {isActive && (
        <div
          className={`mb-4 flex items-center gap-3 rounded-3xl border p-4 ${
            collectCash ? "border-blue-300 bg-blue-50" : "border-sky-200 bg-sky-50"
          }`}
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">{collectCash ? "💵" : "✅"}</span>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-bold ${collectCash ? "text-blue-900" : "text-sky-900"}`}>
              {collectCash ? t("rider_task.collect_cash") : t("rider_task.paid_online")}
            </p>
            <p className={`text-xs ${collectCash ? "text-blue-700" : "text-sky-700"}`}>
              {collectCash ? t("rider_task.collect_cash_hint") : t("rider_task.paid_online_hint")}
            </p>
          </div>
          {collectCash && <p className="shrink-0 text-xl font-extrabold text-blue-900">{money(order.total)}</p>}
        </div>
      )}

      <div className="mb-4 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
        <DeliveryProgressStepper status={order.status} t={t} />
      </div>

      <div className="mb-4 flex flex-col gap-3">
        {order.warehouses && (
          <StopCard
            active={isActive && isPickupStage}
            label={t("rider_task.pickup_stop")}
            title={order.warehouses.name}
            lines={[order.warehouses.address_line]}
          >
            <a
              href={directionsUrl(order.warehouses, order.warehouses.address_line ?? order.warehouses.name)}
              target="_blank"
              rel="noopener noreferrer"
              className={`${actionBtn} bg-blue-700 text-white`}
            >
              🧭 {t("rider_task.navigate")}
            </a>
          </StopCard>
        )}

        {order.addresses && (
          <StopCard
            active={isActive && !isPickupStage}
            label={t("rider_task.dropoff_stop")}
            title={order.addresses.receiver_name || order.addresses.label}
            lines={[
              order.addresses.address_line,
              (order.addresses.building_number || order.addresses.unit_number) &&
                [
                  order.addresses.building_number && `${t("addresses.bldg_short")} ${order.addresses.building_number}`,
                  order.addresses.unit_number && `${t("addresses.unit_short")} ${order.addresses.unit_number}`,
                ]
                  .filter(Boolean)
                  .join(", "),
            ]}
          >
            <a
              href={directionsUrl(order.addresses, order.addresses.address_line)}
              target="_blank"
              rel="noopener noreferrer"
              className={`${actionBtn} bg-blue-700 text-white`}
            >
              🧭 {t("rider_task.navigate")}
            </a>
            {customerPhone && (
              <a href={`tel:${customerPhone}`} className={`${actionBtn} border border-neutral-300 bg-white text-neutral-800`}>
                📞 {t("rider_task.call")}
              </a>
            )}
          </StopCard>
        )}
      </div>

      {order.notes && (
        <div className="mb-4 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">{t("rider_task.customer_note")}</p>
          <p className="mt-1 text-sm text-neutral-800">{order.notes}</p>
        </div>
      )}

      <div className="mb-4 overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-4 py-3">
          <p className="text-sm font-bold text-neutral-900">{t("rider_task.items_title", { count: itemCount })}</p>
          {isPickupStage && isActive && <p className="text-xs text-neutral-500">{t("rider_task.check_items")}</p>}
        </div>
        {order.order_items.map((item: { id: string; product_name: string; variant_label: string; ordered_quantity: number; line_total: number }) => (
          <div key={item.id} className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3 text-sm last:border-none">
            <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-blue-50 px-1 text-sm font-extrabold text-blue-700">{item.ordered_quantity}×</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-neutral-900">{item.product_name}</span>
              <span className="block text-xs text-neutral-500">{item.variant_label}</span>
            </span>
            <span className="shrink-0 text-neutral-700">{money(item.line_total)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-bold">
          <span>{t("checkout.total")}</span>
          <span>{money(order.total)}</span>
        </div>
      </div>

      {user && (
        <div className="mb-4">
          <OrderChat orderId={order.id} currentUserId={user.id} otherPartyLabel="customer" initialMessages={messages} />
        </div>
      )}

      {/* primary action pinned to the bottom of the screen */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 px-4 pt-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <div className="mx-auto max-w-2xl">
          <DeliveryActions orderId={order.id} status={order.status} />
        </div>
      </div>
    </div>
  );
}

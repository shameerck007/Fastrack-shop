import Link from "@/components/Link";
import { notFound } from "next/navigation";
import OrderStatusSelect from "@/components/admin/OrderStatusSelect";
import DownloadInvoiceButton from "@/components/DownloadInvoiceButton";
import DownloadLabelButton from "@/components/DownloadLabelButton";
import FulfillmentBadge from "@/components/admin/FulfillmentBadge";
import RefundDialog from "@/components/admin/RefundDialog";
import PickupCodeBadge from "@/components/PickupCodeBadge";
import RiderPayAdjustDialog from "@/components/admin/RiderPayAdjustDialog";
import { createClient } from "@/lib/supabase/server";
import { getAdminOrderDetail } from "@/lib/admin-orders";
import { ORDER_STATUS_FLOW, PAYMENT_METHOD_LABELS } from "@/lib/utils";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import { getCurrentTenant, getMoney } from "@/lib/tenant-server";
import LiveEtaChip from "@/components/LiveEtaChip";
import { clockIn, liveEtaOf } from "@/lib/live-eta";
import { timeZoneFor } from "@/lib/admin-dashboard";

/** The current time, read outside the page so rendering stays predictable. */
function currentMs(): number {
  return Date.now();
}

const DELIVERY_TYPE_KEY: Record<string, string> = {
  express: "admin.delivery_express",
  standard: "admin.delivery_standard",
  scheduled: "admin.delivery_scheduled",
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-neutral-700">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-0.5 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const money = await getMoney();
  const { id } = await params;
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const order = await getAdminOrderDetail(id);
  if (!order) notFound();

  const payment = order.payments[0];
  const rider = order.delivery_assignments?.delivery_partners?.profiles ?? null;
  const addr = order.addresses;
  const cancelled = order.status === "cancelled";
  const currentStep = ORDER_STATUS_FLOW.indexOf(order.status as (typeof ORDER_STATUS_FLOW)[number]);
  const historyByStatus = new Map(order.order_status_history.map((h) => [h.status, h]));
  const totalUnits = order.items.reduce((sum, i) => sum + Number(i.ordered_quantity), 0);
  const merchantNames = [...new Set(order.items.filter((i) => i.store_name).map((i) => i.store_name as string))];
  const fromFastrack = order.items.some((i) => !i.store_name);
  const fulfillment = { fromFastrack, merchantNames };
  // What has already been refunded (the refund tables arrive with migration 0092), so the dialog only offers what is left.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createClient()) as any;
  const refundRows = ((await db.from("order_refunds").select("id, amount, delivery_amount, reason, created_at, order_refund_items(order_item_id, quantity)").eq("order_id", id).order("created_at", { ascending: false })).data ?? []) as { id: string; amount: number; delivery_amount: number; reason: string | null; created_at: string; order_refund_items: { order_item_id: string; quantity: number }[] }[];
  const refundedQty = new Map<string, number>();
  for (const r of refundRows) for (const it of r.order_refund_items) refundedQty.set(it.order_item_id, (refundedQty.get(it.order_item_id) ?? 0) + Number(it.quantity));
  const deliveryRefunded = refundRows.some((r) => Number(r.delivery_amount) > 0);
  const refundItems = (order.order_items as unknown as { id: string; product_name: string; variant_label: string | null; ordered_quantity: number; line_total: number; discount_amount?: number | null }[]).map((i) => ({
    id: i.id,
    name: i.variant_label ? `${i.product_name} (${i.variant_label})` : i.product_name,
    ordered: Number(i.ordered_quantity),
    refunded: refundedQty.get(i.id) ?? 0,
    unitNet: Number(i.ordered_quantity) > 0 ? (Number(i.line_total) - Number(i.discount_amount ?? 0)) / Number(i.ordered_quantity) : 0,
  }));
  // Rider pay when an order goes wrong (migration 0094): what the rider earns on this order, and whether an adjustment was already recorded.
  const assignmentRow = ((await db.from("delivery_assignments").select("rider_id, rider_pay").eq("order_id", id).maybeSingle()).data ?? null) as { rider_id: string; rider_pay: number | null } | null;
  const adjustments = assignmentRow ? (((await db.from("rider_settlement_entries").select("reference, amount").eq("rider_id", assignmentRow.rider_id).in("reference", [`failed:${id}`, `refund:${id}`])).data ?? []) as { reference: string; amount: number }[]) : [];
  const failedPaid = adjustments.find((a) => a.reference.startsWith("failed:"));
  const clawed = adjustments.find((a) => a.reference.startsWith("refund:"));
  const riderPayHere = assignmentRow ? Number(assignmentRow.rider_pay ?? order.delivery_fee) : 0;
  const refundedTotal = Number((order as unknown as { refunded_amount?: number | string | null }).refunded_amount ?? 0);
  const tz = timeZoneFor((await getCurrentTenant())?.country_code);
  const live = liveEtaOf(order as never, currentMs());
  const promisedAt = (order as unknown as { estimated_delivery_at?: string | null }).estimated_delivery_at ?? null;
  const promisedClock = promisedAt ? clockIn(promisedAt, tz, locale) : null;

  return (
    <div>
      <Link href="/admin/orders" className="text-sm text-blue-600 hover:underline">
        {t("admin.all_orders")}
      </Link>

      <div className="mb-4 mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t("orders.order_hash", { number: order.order_number })}</h1>
          <p className="text-sm text-neutral-500">
            {t("admin.placed", {
              date: new Date(order.created_at).toLocaleString(locale === "ar" ? "ar-SA" : "en-US"),
              count: order.items.length,
              plural: order.items.length === 1 ? "" : "s",
              units: totalUnits,
            })}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-xs text-neutral-400">{t("admin.fulfilled_by")}</span>
            <FulfillmentBadge fulfillment={fulfillment} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-52 [&_select]:h-9 [&_select]:shadow-sm">
            <OrderStatusSelect orderId={order.id} status={order.status} />
          </div>
          <DownloadLabelButton orderId={order.id} orderNumber={order.order_number} />
          <DownloadInvoiceButton orderId={order.id} orderNumber={order.order_number} />
        </div>
      </div>

      {/* Progress tracker */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-4">
        {cancelled ? (
          <p className="text-sm font-medium text-rose-600">
            {t("admin.order_cancelled")}
            {historyByStatus.get("cancelled") &&
              t("admin.on_date", {
                date: new Date(historyByStatus.get("cancelled")!.created_at).toLocaleString(locale === "ar" ? "ar-SA" : "en-US"),
              })}
          </p>
        ) : (
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {ORDER_STATUS_FLOW.map((step, index) => {
              const done = index <= currentStep;
              const at = historyByStatus.get(step)?.created_at;
              return (
                <li key={step} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                        done ? "bg-emerald-500 text-white" : "bg-neutral-200 text-neutral-500"
                      }`}
                    >
                      {done ? "✓" : index + 1}
                    </span>
                    <span className={`text-xs font-medium ${done ? "text-neutral-900" : "text-neutral-400"}`}>
                      {t(`order_status.${step}`)}
                    </span>
                  </div>
                  {at && (
                    <span className="ps-7 text-[11px] text-neutral-400">
                      {new Date(at).toLocaleString(locale === "ar" ? "ar-SA" : "en-US")}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card title={t("admin.items_count", { count: order.items.length })}>
            <div className="divide-y divide-neutral-100">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image_url} alt={item.product_name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xl">📦</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.product_name}</p>
                    <p className="text-xs text-neutral-500">
                      {[item.brand, item.variant_label].filter(Boolean).join(" · ")}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          item.store_name ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {item.store_name ? `🏪 ${item.store_name}` : "🏬 FasTrack"}
                      </span>
                      {item.is_substituted && (
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                          {t("product.substituted")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-neutral-500">
                      {money(item.unit_price)} × {Number(item.ordered_quantity)}
                    </p>
                    <p className="font-medium">{money(item.line_total)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title={t("admin.payment_summary")}>
            <Row label={t("orders.item_subtotal")}>{money(order.subtotal)}</Row>
            <Row label={t("checkout.delivery_fee")}>
              {order.delivery_fee === 0 ? t("checkout.free") : money(order.delivery_fee)}
            </Row>
            {order.discount > 0 && (
              <Row label={`${t("orders.discount")}${order.coupon_code ? ` (${order.coupon_code})` : ""}`}>
                <span className="text-blue-600">-{money(order.discount)}</span>
              </Row>
            )}
            <div className="mt-2 flex justify-between border-t border-neutral-200 pt-2 font-semibold">
              <span>{t("admin.order_total")}</span>
              <span>{money(order.total)}</span>
            </div>
          </Card>

          <Card title={t("admin.status_history")}>
            {order.order_status_history.length === 0 ? (
              <p className="text-sm text-neutral-400">{t("admin.no_history")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {[...order.order_status_history].reverse().map((h) => (
                  <li key={h.id} className="flex justify-between gap-4 text-sm">
                    <span>
                      {t(`order_status.${h.status}`)}
                      {h.note && <span className="ms-2 text-neutral-400">— {h.note}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-neutral-400">
                      {new Date(h.created_at).toLocaleString(locale === "ar" ? "ar-SA" : "en-US")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          {live && (
            <Card title="Live delivery">
              <Row label="Arriving">
                <LiveEtaChip clock={clockIn(live.at, tz, locale)} lateBy={live.lateBy} stopsBefore={live.stopsBefore} label="ETA" stopsText={`${live.stopsBefore} stop${live.stopsBefore === 1 ? "" : "s"} first`} />
              </Row>
              {promisedClock && <Row label="Promised at checkout">{promisedClock}</Row>}
              {live.km != null && <Row label="Distance left">{live.km.toFixed(1)} km</Row>}
              {live.ageSec != null && <Row label="Updated">{live.ageSec < 90 ? `${live.ageSec} s ago` : `${Math.round(live.ageSec / 60)} min ago`}</Row>}
            </Card>
          )}

          <Card title={t("admin.customer")}>
            <p className="font-medium">{order.profiles?.full_name ?? "—"}</p>
            {order.profiles?.phone ? (
              <a href={`tel:${order.profiles.phone}`} className="text-sm text-blue-600 hover:underline">
                📞 {order.profiles.phone}
              </a>
            ) : (
              <p className="text-sm text-neutral-400">{t("admin.no_phone")}</p>
            )}
          </Card>

          <Card title={t("admin.delivery_address")}>
            {addr ? (
              <div className="text-sm">
                <p className="mb-0.5 text-xs font-medium uppercase text-neutral-400">{addr.label}</p>
                {addr.receiver_name && (
                  <p className="font-medium">
                    {t("admin.receiver", { name: addr.receiver_name })}
                    {addr.receiver_phone && (
                      <a href={`tel:${addr.receiver_phone}`} className="ms-2 font-normal text-blue-600 hover:underline">
                        📞 {addr.receiver_phone}
                      </a>
                    )}
                  </p>
                )}
                <p>{addr.address_line}</p>
                <p className="text-neutral-500">
                  {[
                    addr.building_number && `${t("addresses.bldg_short")} ${addr.building_number}`,
                    addr.unit_number && `${t("addresses.unit_short")} ${addr.unit_number}`,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                <p className="text-neutral-500">
                  {[addr.district, addr.city, addr.postal_code].filter(Boolean).join(", ")}
                </p>
                {addr.short_address && (
                  <p className="text-neutral-500">{t("admin.short_address", { code: addr.short_address })}</p>
                )}
                {addr.lat != null && addr.lng != null && (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${addr.lat}&mlon=${addr.lng}#map=17/${addr.lat}/${addr.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-blue-600 hover:underline"
                  >
                    {t("admin.view_on_map")}
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-neutral-400">{t("admin.no_address_recorded")}</p>
            )}
          </Card>

          <Card title={t("admin.delivery")}>
            <Row label={t("admin.type_label")}>{t(DELIVERY_TYPE_KEY[order.delivery_type] ?? "admin.delivery_standard")}</Row>
            {order.scheduled_for && (
              <Row label={t("admin.scheduled_for")}>{new Date(order.scheduled_for).toLocaleString(locale === "ar" ? "ar-SA" : "en-US")}</Row>
            )}
            <Row label={t("orders.rider")}>
              {rider ? (
                <>
                  {rider.full_name ?? "—"}
                  {rider.phone && (
                    <a href={`tel:${rider.phone}`} className="block text-xs text-blue-600 hover:underline">
                      📞 {rider.phone}
                    </a>
                  )}
                </>
              ) : (
                <span className="text-neutral-400">{t("admin.not_assigned")}</span>
              )}
            </Row>
            {rider && <div className="mt-1 flex justify-end"><PickupCodeBadge orderId={id} status={order.status} /></div>}
            {assignmentRow && cancelled && (failedPaid ? <Row label="Failed delivery"><span className="text-emerald-700">Rider paid {money(Number(failedPaid.amount))}</span></Row> : riderPayHere > 0 ? <RiderPayAdjustDialog orderId={id} kind="failed_delivery" max={riderPayHere} suggested={riderPayHere} riderName={rider?.full_name ?? "the rider"} /> : null)}
            {assignmentRow && order.status === "delivered" && refundedTotal > 0 && (clawed ? <Row label="Refund deduction"><span className="text-amber-700">-{money(Number(clawed.amount))} from the rider</span></Row> : <RiderPayAdjustDialog orderId={id} kind="refund_clawback" max={refundedTotal} suggested={Math.min(refundedTotal, riderPayHere)} riderName={rider?.full_name ?? "the rider"} />)}
            {order.notes && (
              <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                <b>{t("admin.customer_note")}</b> {order.notes}
              </p>
            )}
          </Card>

          <Card title={t("admin.payment")}>
            {payment ? (
              <>
                <Row label={t("admin.method_label")}>
                  {payment.method === "cash_on_delivery" ? t("admin.cash_on_delivery") : (PAYMENT_METHOD_LABELS[payment.method] ?? payment.method)}
                </Row>
                <Row label={t("admin.status_label")}>
                  <span className="capitalize">{payment.status}</span>
                </Row>
                <Row label={t("admin.amount_label")}>{money(payment.amount)}</Row>
                {refundedTotal > 0 && <Row label="Refunded so far"><span className="font-semibold text-amber-700">-{money(refundedTotal)}</span></Row>}
                {order.status !== "cancelled" && refundItems.some((i) => i.ordered - i.refunded > 0) || (!deliveryRefunded && order.delivery_fee > 0) ? (
                  <div className="mt-2">
                    <RefundDialog orderId={id} items={refundItems} deliveryFee={Number(order.delivery_fee)} deliveryRefunded={deliveryRefunded} />
                  </div>
                ) : null}
                {refundRows.length > 0 && (
                  <ul className="mt-3 divide-y divide-neutral-100 border-t border-neutral-100 text-xs">
                    {refundRows.map((r) => (
                      <li key={r.id} className="flex justify-between gap-3 py-1.5">
                        <span className="text-neutral-500">
                          {new Date(r.created_at).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")}
                          {r.reason ? ` · ${r.reason}` : ""}
                        </span>
                        <b className="text-amber-700">-{money(Number(r.amount))}</b>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-sm text-neutral-400">{t("admin.no_payment_record")}</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

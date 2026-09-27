import Link from "next/link";
import { notFound } from "next/navigation";
import OrderStatusSelect from "@/components/admin/OrderStatusSelect";
import DownloadInvoiceButton from "@/components/DownloadInvoiceButton";
import { getAdminOrderDetail } from "@/lib/admin-orders";
import {
  formatSAR,
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  DELIVERY_TYPE_LABELS,
} from "@/lib/utils";

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
  const { id } = await params;
  const order = await getAdminOrderDetail(id);
  if (!order) notFound();

  const payment = order.payments[0];
  const rider = order.delivery_assignments?.delivery_partners?.profiles ?? null;
  const addr = order.addresses;
  const cancelled = order.status === "cancelled";
  const currentStep = ORDER_STATUS_FLOW.indexOf(order.status as (typeof ORDER_STATUS_FLOW)[number]);
  const historyByStatus = new Map(order.order_status_history.map((h) => [h.status, h]));
  const totalUnits = order.items.reduce((sum, i) => sum + Number(i.ordered_quantity), 0);

  return (
    <div>
      <Link href="/admin/orders" className="text-sm text-blue-600 hover:underline">
        ← All orders
      </Link>

      <div className="mb-4 mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Order #{order.order_number}</h1>
          <p className="text-sm text-neutral-500">
            Placed {new Date(order.created_at).toLocaleString()} · {order.items.length} item
            {order.items.length === 1 ? "" : "s"} ({totalUnits} units)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusSelect orderId={order.id} status={order.status} />
          <DownloadInvoiceButton orderId={order.id} />
        </div>
      </div>

      {/* Progress tracker */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-4">
        {cancelled ? (
          <p className="text-sm font-medium text-rose-600">
            ✕ Order cancelled
            {historyByStatus.get("cancelled") &&
              ` on ${new Date(historyByStatus.get("cancelled")!.created_at).toLocaleString()}`}
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
                      {ORDER_STATUS_LABELS[step]}
                    </span>
                  </div>
                  {at && (
                    <span className="pl-7 text-[11px] text-neutral-400">
                      {new Date(at).toLocaleString()}
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
          <Card title={`Items (${order.items.length})`}>
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
                    <p className="text-xs text-neutral-400">
                      Sold by {item.store_name ?? "FasTrack"}
                      {item.is_substituted && (
                        <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">
                          Substituted
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-neutral-500">
                      {formatSAR(item.unit_price)} × {Number(item.ordered_quantity)}
                    </p>
                    <p className="font-medium">{formatSAR(item.line_total)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Payment summary">
            <Row label="Subtotal (incl. VAT)">{formatSAR(order.subtotal)}</Row>
            <Row label="of which VAT (15%)">
              <span className="text-neutral-400">{formatSAR(order.vat)}</span>
            </Row>
            <Row label="Delivery fee">
              {order.delivery_fee === 0 ? "Free" : formatSAR(order.delivery_fee)}
            </Row>
            {order.discount > 0 && (
              <Row label={`Discount${order.coupon_code ? ` (${order.coupon_code})` : ""}`}>
                <span className="text-blue-600">-{formatSAR(order.discount)}</span>
              </Row>
            )}
            <div className="mt-2 flex justify-between border-t border-neutral-200 pt-2 font-semibold">
              <span>Order total</span>
              <span>{formatSAR(order.total)}</span>
            </div>
          </Card>

          <Card title="Status history">
            {order.order_status_history.length === 0 ? (
              <p className="text-sm text-neutral-400">No history recorded.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {[...order.order_status_history].reverse().map((h) => (
                  <li key={h.id} className="flex justify-between gap-4 text-sm">
                    <span>
                      {ORDER_STATUS_LABELS[h.status] ?? h.status}
                      {h.note && <span className="ml-2 text-neutral-400">— {h.note}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-neutral-400">
                      {new Date(h.created_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card title="Customer">
            <p className="font-medium">{order.profiles?.full_name ?? "—"}</p>
            {order.profiles?.phone ? (
              <a href={`tel:${order.profiles.phone}`} className="text-sm text-blue-600 hover:underline">
                📞 {order.profiles.phone}
              </a>
            ) : (
              <p className="text-sm text-neutral-400">No phone on file</p>
            )}
          </Card>

          <Card title="Delivery address">
            {addr ? (
              <div className="text-sm">
                <p className="mb-0.5 text-xs font-medium uppercase text-neutral-400">{addr.label}</p>
                <p>{addr.address_line}</p>
                <p className="text-neutral-500">
                  {[addr.building_number && `Bldg ${addr.building_number}`, addr.unit_number && `Unit ${addr.unit_number}`]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                <p className="text-neutral-500">
                  {[addr.district, addr.city, addr.postal_code].filter(Boolean).join(", ")}
                </p>
                {addr.short_address && (
                  <p className="text-neutral-500">Short address: {addr.short_address}</p>
                )}
                {addr.lat != null && addr.lng != null && (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${addr.lat}&mlon=${addr.lng}#map=17/${addr.lat}/${addr.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-blue-600 hover:underline"
                  >
                    📍 View on map
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-neutral-400">No address recorded.</p>
            )}
          </Card>

          <Card title="Delivery">
            <Row label="Type">{DELIVERY_TYPE_LABELS[order.delivery_type] ?? order.delivery_type}</Row>
            {order.scheduled_for && (
              <Row label="Scheduled for">{new Date(order.scheduled_for).toLocaleString()}</Row>
            )}
            <Row label="Rider">
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
                <span className="text-neutral-400">Not assigned</span>
              )}
            </Row>
            {order.notes && (
              <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                <b>Customer note:</b> {order.notes}
              </p>
            )}
          </Card>

          <Card title="Payment">
            {payment ? (
              <>
                <Row label="Method">{PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}</Row>
                <Row label="Status">
                  <span className="capitalize">{payment.status}</span>
                </Row>
                <Row label="Amount">{formatSAR(payment.amount)}</Row>
              </>
            ) : (
              <p className="text-sm text-neutral-400">No payment record.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

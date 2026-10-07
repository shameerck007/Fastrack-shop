"use client";

import { useMemo, useState } from "react";
import Link from "@/components/Link";
import OrderStatusSelect from "@/components/admin/OrderStatusSelect";
import { useLocale } from "@/components/LocaleProvider";
import { useMoney } from "@/components/MoneyProvider";
import type { OrderStatus } from "@/types/database";

export interface ExplorerOrder {
  id: string;
  number: string;
  status: OrderStatus;
  createdAt: string;
  customer: string;
  phone: string | null;
  itemCount: number;
  itemsText: string;
  thumbs: string[];
  delivery: string;
  area: string | null;
  payment: string;
  paid: boolean;
  fulfilledBy: { text: string; tone: "fastrack" | "merchant" | "mixed" | "none" };
  total: number;
}

export interface ExplorerCounts {
  pending: number;
  preparing: number;
  ready: number;
  out: number;
}

type Stage = "all" | "pending" | "preparing" | "ready" | "out" | "delivered" | "cancelled";

const STAGE_OF: Record<OrderStatus, Exclude<Stage, "all">> = {
  pending: "pending",
  confirmed: "preparing",
  preparing: "preparing",
  ready_for_pickup: "ready",
  rider_assigned: "out",
  out_for_delivery: "out",
  delivered: "delivered",
  cancelled: "cancelled",
};

const STAGES: { key: Exclude<Stage, "all">; label: string; icon: string; accent: string; hint: string }[] = [
  { key: "pending", label: "New", icon: "🆕", accent: "#dc2626", hint: "Waiting for you" },
  { key: "preparing", label: "Preparing", icon: "👨‍🍳", accent: "#d97706", hint: "Confirmed or being packed" },
  { key: "ready", label: "Ready", icon: "📦", accent: "#2563eb", hint: "Waiting for a rider" },
  { key: "out", label: "On the way", icon: "🛵", accent: "#7c3aed", hint: "Rider assigned or out" },
  { key: "delivered", label: "Delivered", icon: "✅", accent: "#059669", hint: "In the latest orders" },
  { key: "cancelled", label: "Cancelled", icon: "✕", accent: "#64748b", hint: "In the latest orders" },
];

const STATUS_BADGE: Record<OrderStatus, string> = {
  pending: "bg-red-50 text-red-700 ring-red-100",
  confirmed: "bg-amber-50 text-amber-700 ring-amber-100",
  preparing: "bg-amber-50 text-amber-700 ring-amber-100",
  ready_for_pickup: "bg-blue-50 text-blue-700 ring-blue-100",
  rider_assigned: "bg-violet-50 text-violet-700 ring-violet-100",
  out_for_delivery: "bg-violet-50 text-violet-700 ring-violet-100",
  delivered: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  cancelled: "bg-neutral-100 text-neutral-600 ring-neutral-200",
};

const FULFIL_TONE = {
  fastrack: "bg-blue-50 text-blue-700",
  merchant: "bg-amber-50 text-amber-700",
  mixed: "bg-purple-50 text-purple-700",
  none: "bg-neutral-100 text-neutral-500",
};

function age(iso: string): { label: string; tone: string } {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  const label =
    minutes < 60 ? `${minutes}m` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${Math.floor(minutes / 1440)}d`;
  const tone = minutes < 15 ? "bg-emerald-50 text-emerald-700" : minutes < 30 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
  return { label, tone };
}

function Thumbs({ thumbs, extra }: { thumbs: string[]; extra: number }) {
  return (
    <div className="flex shrink-0 -space-x-2 rtl:space-x-reverse">
      {thumbs.map((src, i) => (
        <span key={i} className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border-2 border-white bg-neutral-100 shadow-sm">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-base">📦</span>
          )}
        </span>
      ))}
      {extra > 0 && (
        <span className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-white bg-neutral-800 text-[11px] font-bold text-white shadow-sm">+{extra}</span>
      )}
    </div>
  );
}

export default function OrdersExplorer({
  orders,
  counts,
  today,
}: {
  orders: ExplorerOrder[];
  counts: ExplorerCounts;
  today: { orders: number; delivered: number; cancelled: number; revenue: number };
}) {
  const { t } = useLocale();
  const money = useMoney();
  const [stage, setStage] = useState<Stage>("all");
  const [q, setQ] = useState("");

  const stageCount: Record<Exclude<Stage, "all">, number> = {
    pending: counts.pending,
    preparing: counts.preparing,
    ready: counts.ready,
    out: counts.out,
    delivered: orders.filter((o) => o.status === "delivered").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
  };
  const openTotal = counts.pending + counts.preparing + counts.ready + counts.out;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = orders.filter(
      (o) =>
        (stage === "all" || STAGE_OF[o.status] === stage) &&
        (!needle || [o.number, o.customer, o.phone, o.itemsText, o.area, o.payment, o.status].some((f) => f?.toLowerCase().includes(needle)))
    );
    // Work queues show the oldest first (longest waiting); history stays newest first.
    const queue = stage !== "all" && stage !== "delivered" && stage !== "cancelled";
    return [...filtered].sort((a, b) => (queue ? +new Date(a.createdAt) - +new Date(b.createdAt) : +new Date(b.createdAt) - +new Date(a.createdAt)));
  }, [orders, stage, q]);

  const isOpen = (s: OrderStatus) => s !== "delivered" && s !== "cancelled";

  return (
    <div className="flex flex-col gap-4">
      {/* today */}
      <div className="grid grid-cols-2 divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm sm:grid-cols-4 sm:divide-x">
        {[
          { label: "Orders today", value: String(today.orders), icon: "🧾" },
          { label: "Delivered", value: String(today.delivered), icon: "✅" },
          { label: "Cancelled", value: String(today.cancelled), icon: "✕" },
          { label: "Revenue today", value: money(today.revenue), icon: "💰" },
        ].map((x, i) => (
          <div key={x.label} className={`flex items-center gap-3 px-4 py-3 ${i > 1 ? "border-t border-neutral-100 sm:border-t-0" : ""}`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-base">{x.icon}</span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-neutral-500">{x.label}</p>
              <p className="text-base font-extrabold leading-tight text-neutral-900 sm:text-lg">{x.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* stages */}
      <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-6 [&::-webkit-scrollbar]:hidden">
        {STAGES.map((s) => {
          const active = stage === s.key;
          const n = stageCount[s.key];
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setStage(active ? "all" : s.key)}
              className={`relative flex min-w-[8.5rem] shrink-0 flex-col items-start gap-1 rounded-2xl border bg-white p-3 text-start shadow-sm transition sm:min-w-0 ${
                active ? "border-transparent ring-2" : "border-neutral-200 hover:border-blue-200 hover:shadow"
              }`}
              style={active ? { boxShadow: `0 0 0 2px ${s.accent}` } : undefined}
            >
              <span className="flex w-full items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl text-base" style={{ background: `${s.accent}1a`, color: s.accent }}>
                  {s.icon}
                </span>
                <span className="text-2xl font-extrabold leading-none text-neutral-900">{n}</span>
              </span>
              <span className="text-sm font-bold text-neutral-800">{s.label}</span>
              <span className="text-[11px] text-neutral-400">{s.hint}</span>
              {s.key === "pending" && n > 0 && <span className="absolute end-2 top-2 h-2 w-2 animate-ping rounded-full bg-red-500" />}
            </button>
          );
        })}
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">🔍</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search order no., customer, phone, product…"
            className="w-full rounded-full border border-neutral-300 bg-white py-2 pe-4 ps-9 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span>
            Showing <b className="text-neutral-800">{rows.length}</b> {stage === "all" ? "recent orders" : `${STAGES.find((s) => s.key === stage)?.label.toLowerCase()} orders`}
          </span>
          {stage !== "all" && (
            <button type="button" onClick={() => setStage("all")} className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 hover:bg-blue-100">
              Clear filter ✕
            </button>
          )}
          {stage === "all" && openTotal > 0 && <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-semibold text-neutral-600">{openTotal} open</span>}
        </div>
      </div>

      {/* list */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
          <span className="text-4xl">📭</span>
          <p className="font-semibold text-neutral-700">No orders here</p>
          <p className="text-sm text-neutral-500">{q || stage !== "all" ? "Try a different search or clear the filter." : "New orders will show up here live."}</p>
        </div>
      ) : (
        <>
          {/* desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  <th className="px-4 py-2.5 text-start">Order</th>
                  <th className="px-3 py-2.5 text-start">Customer</th>
                  <th className="px-3 py-2.5 text-start">Items</th>
                  <th className="px-3 py-2.5 text-start">Delivery · Payment</th>
                  <th className="px-3 py-2.5 text-end">Total</th>
                  <th className="px-4 py-2.5 text-start">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.map((o) => {
                  const a = age(o.createdAt);
                  return (
                    <tr key={o.id} className="align-top transition hover:bg-blue-50/40">
                      <td className="px-4 py-3">
                        <Link href={`/admin/orders/${o.id}`} className="font-extrabold text-neutral-900 hover:text-blue-700">
                          #{o.number}
                        </Link>
                        <p className="mt-0.5 text-[11px] text-neutral-400">{new Date(o.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                        {isOpen(o.status) && <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${a.tone}`}>⏱ {a.label}</span>}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-neutral-800">{o.customer}</p>
                        {o.phone && <p className="text-xs text-neutral-400">{o.phone}</p>}
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-2.5">
                          <Thumbs thumbs={o.thumbs} extra={Math.max(o.itemCount - o.thumbs.length, 0)} />
                          <span className="min-w-0 max-w-[14rem]">
                            <span className="block truncate text-neutral-700">{o.itemsText}</span>
                            <span className="text-[11px] text-neutral-400">
                              {o.itemCount} {o.itemCount === 1 ? "item" : "items"}
                            </span>
                          </span>
                        </Link>
                        <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${FULFIL_TONE[o.fulfilledBy.tone]}`}>{o.fulfilledBy.text}</span>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <p className="font-semibold text-neutral-700">{o.delivery}</p>
                        {o.area && <p className="text-neutral-400">{o.area}</p>}
                        <p className="mt-1 text-neutral-600">
                          {o.payment}{" "}
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${o.paid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{o.paid ? "Paid" : "Unpaid"}</span>
                        </p>
                      </td>
                      <td className="px-3 py-3 text-end font-extrabold text-neutral-900">{money(o.total)}</td>
                      <td className="px-4 py-3">
                        <span className={`mb-1.5 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${STATUS_BADGE[o.status]}`}>{t(`order_status.${o.status}`)}</span>
                        <div>
                          <OrderStatusSelect orderId={o.id} status={o.status} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* mobile cards */}
          <ul className="flex flex-col gap-3 md:hidden">
            {rows.map((o) => {
              const a = age(o.createdAt);
              return (
                <li key={o.id} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                  <div className="flex items-start justify-between gap-2 p-3.5">
                    <div className="min-w-0">
                      <Link href={`/admin/orders/${o.id}`} className="text-base font-extrabold text-neutral-900">
                        #{o.number}
                      </Link>
                      <p className="truncate text-sm text-neutral-600">{o.customer}</p>
                      <p className="text-[11px] text-neutral-400">{new Date(o.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <div className="text-end">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${STATUS_BADGE[o.status]}`}>{t(`order_status.${o.status}`)}</span>
                      {isOpen(o.status) && <p className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${a.tone}`}>⏱ {a.label}</p>}
                    </div>
                  </div>
                  <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-3 border-t border-neutral-100 px-3.5 py-3">
                    <Thumbs thumbs={o.thumbs} extra={Math.max(o.itemCount - o.thumbs.length, 0)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-neutral-700">{o.itemsText}</span>
                      <span className="text-[11px] text-neutral-400">
                        {o.itemCount} {o.itemCount === 1 ? "item" : "items"} · {o.delivery} · {o.payment}
                      </span>
                    </span>
                    <span className="shrink-0 text-base font-extrabold text-neutral-900">{money(o.total)}</span>
                  </Link>
                  <div className="flex items-center justify-between gap-2 border-t border-neutral-100 bg-neutral-50 px-3.5 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${FULFIL_TONE[o.fulfilledBy.tone]}`}>{o.fulfilledBy.text}</span>
                    <OrderStatusSelect orderId={o.id} status={o.status} />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

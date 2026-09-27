"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import ZoneEditor from "@/components/admin/ZoneEditor";

export interface ZoneCard {
  warehouseId: string;
  warehouseName: string;
  storeAddress: string | null;
  contactPhone: string | null;
  displayName: string;
  color: string;
  zoned: boolean;
  radius: number | null;
  lat: number | null;
  lng: number | null;
  productCount: number;
  orderCount: number;
  inside: number | null;
}

function initials(name: string): string {
  const words = name.replace(/\(.*\)/, "").trim().split(/\s+/);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function ZonesList({ cards }: { cards: ZoneCard[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = cards.find((c) => c.warehouseId === activeId) ?? null;

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-neutral-700">Stores</h2>
          <span className="text-xs text-neutral-400">{cards.length} total</span>
        </div>

        {cards.length === 0 ? (
          <p className="p-6 text-sm text-neutral-500">No active warehouses yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {cards.map((c) => (
              <li
                key={c.warehouseId}
                className="group flex flex-wrap items-center gap-4 px-5 py-4 transition hover:bg-neutral-50"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
                  style={{ background: c.color }}
                >
                  {initials(c.displayName)}
                </span>

                <div className="min-w-[10rem] flex-1">
                  <p className="truncate font-medium text-neutral-900">{c.displayName}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {c.storeAddress ?? c.warehouseName}
                    {c.contactPhone && ` · ${c.contactPhone}`}
                  </p>
                </div>

                <div className="flex min-w-[8rem] flex-col items-start gap-0.5">
                  <span
                    className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      c.zoned ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {c.zoned ? `🎯 Within ${c.radius} km` : "🌐 Everywhere"}
                  </span>
                  {c.inside != null && (
                    <span className="text-xs text-neutral-400">{c.inside} addresses inside</span>
                  )}
                </div>

                <div className="hidden shrink-0 gap-4 text-xs text-neutral-500 sm:flex">
                  <span>
                    <b className="text-neutral-700">{c.productCount}</b> products
                  </span>
                  <span>
                    <b className="text-neutral-700">{c.orderCount}</b> orders
                  </span>
                </div>

                <button
                  onClick={() => setActiveId(c.warehouseId)}
                  className={`ml-auto shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                    c.zoned
                      ? "border border-neutral-300 text-neutral-700 hover:bg-neutral-100"
                      : "bg-blue-600 text-white shadow-sm hover:bg-blue-700"
                  }`}
                >
                  {c.zoned ? "Edit boundary" : "Set boundary →"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={!!active} onClose={() => setActiveId(null)} title={active?.displayName} size="xl">
        {active && (
          <ZoneEditor
            warehouseId={active.warehouseId}
            storeAddress={active.storeAddress}
            initialLat={active.lat}
            initialLng={active.lng}
            initialRadiusKm={active.radius}
          />
        )}
      </Modal>
    </>
  );
}

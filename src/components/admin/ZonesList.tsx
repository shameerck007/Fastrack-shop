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

export default function ZonesList({ cards }: { cards: ZoneCard[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = cards.find((c) => c.warehouseId === activeId) ?? null;

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-2">Store</th>
              <th className="px-4 py-2">Boundary</th>
              <th className="px-4 py-2">Activity</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.warehouseId} className="border-t border-neutral-100">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.displayName}</p>
                      <p className="truncate text-xs text-neutral-400">
                        {c.storeAddress ?? c.warehouseName}
                        {c.contactPhone && ` · ${c.contactPhone}`}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      c.zoned ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {c.zoned ? `Within ${c.radius} km` : "Everywhere"}
                  </span>
                  {c.inside != null && (
                    <p className="mt-0.5 text-xs text-neutral-400">{c.inside} addresses inside</p>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-neutral-500">
                  {c.productCount} products
                  <br />
                  {c.orderCount} orders
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setActiveId(c.warehouseId)}
                    className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium hover:bg-neutral-50"
                  >
                    {c.zoned ? "Edit boundary" : "Set boundary"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {cards.length === 0 && (
          <p className="p-4 text-sm text-neutral-500">No active warehouses yet.</p>
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

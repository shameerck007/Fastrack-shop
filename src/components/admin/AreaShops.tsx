"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import LocationPicker from "@/components/LocationPicker";
import Select from "@/components/ui/Select";
import { Field, inputClass, primaryButton, secondaryButton } from "@/components/ui/Form";
import { setWarehouseExpressOverride, setWarehouseLocation } from "@/lib/actions/admin-areas";

export interface AreaShopRow {
  id: string;
  name: string;
  kind: "supplier" | "fastrack";
  address: string | null;
  lat: number | null;
  lng: number | null;
  areaName: string | null;
  areaColor: string | null;
  expressMode: "auto" | "off";
  expressMaxKm: number | null;
  /** The Express distance that applies to this shop (smallest of its area's limit and its own). */
  expressReachKm: number | null;
  expressOn: boolean;
  standardOn: boolean;
}

function status(r: AreaShopRow): { label: string; tone: string } {
  if (r.lat == null || r.lng == null) return { label: "Not live: set the GPS pin", tone: "bg-amber-50 text-amber-800" };
  if (r.expressOn && r.standardOn) return { label: `Express up to ${r.expressReachKm} km + Standard`, tone: "bg-emerald-50 text-emerald-800" };
  if (r.expressOn) return { label: `Express up to ${r.expressReachKm} km`, tone: "bg-emerald-50 text-emerald-800" };
  if (r.standardOn) return { label: r.areaName ? "Standard only" : "Standard only (outside every area)", tone: "bg-blue-50 text-blue-800" };
  return { label: "Not delivering", tone: "bg-neutral-100 text-neutral-500" };
}

export default function AreaShops({ rows }: { rows: AreaShopRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [pin, setPin] = useState<AreaShopRow | null>(null);
  const [rule, setRule] = useState<AreaShopRow | null>(null);
  const needle = q.trim().toLowerCase();
  const shown = rows.filter((r) => !needle || [r.name, r.address, r.areaName].some((f) => f?.toLowerCase().includes(needle)));

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-neutral-900">Shops and warehouses</h2>
          <p className="text-xs text-neutral-500">Each one needs only its GPS pin. The area is found automatically.</p>
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 Search shops…"
          className="h-10 w-full max-w-xs rounded-full border border-neutral-300 px-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:w-64"
        />
      </div>

      {shown.length === 0 ? (
        <p className="p-8 text-center text-sm text-neutral-400">Nothing matches.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {shown.map((r) => {
            const st = status(r);
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
                <div className="min-w-[12rem] flex-1">
                  <p className="font-bold text-neutral-900">
                    {r.name} <span className="ms-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-500">{r.kind === "supplier" ? "Supplier" : "FasTrack"}</span>
                  </p>
                  <p className="truncate text-xs text-neutral-500">
                    {r.lat != null && r.lng != null ? `📍 ${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}` : "📍 No pin yet"}
                    {r.address ? ` · ${r.address}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  {r.areaName ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 font-semibold text-neutral-700">
                      <span className="h-2 w-2 rounded-full" style={{ background: r.areaColor ?? "#2563eb" }} />
                      {r.areaName}
                    </span>
                  ) : r.lat != null ? (
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-semibold text-neutral-500">Outside every area</span>
                  ) : null}
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${st.tone}`}>{st.label}</span>
                {r.expressMode === "off" && <span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-semibold text-neutral-500">Express off for this shop</span>}
                {r.expressMode === "auto" && r.expressMaxKm != null && <span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-semibold text-neutral-500">own limit {r.expressMaxKm} km</span>}
                <div className="ms-auto flex gap-2">
                  <button type="button" onClick={() => setPin(r)} className="h-9 rounded-full border border-neutral-300 px-4 text-xs font-bold text-neutral-700 hover:bg-neutral-50">
                    {r.lat != null ? "Move pin" : "Set pin"}
                  </button>
                  <button type="button" onClick={() => setRule(r)} className="h-9 rounded-full border border-neutral-300 px-4 text-xs font-bold text-neutral-700 hover:bg-neutral-50">
                    Express rule
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pin && (
        <PinModal
          row={pin}
          onClose={() => setPin(null)}
          onSaved={() => {
            setPin(null);
            router.refresh();
          }}
        />
      )}
      {rule && (
        <RuleModal
          row={rule}
          onClose={() => setRule(null)}
          onSaved={() => {
            setRule(null);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

function PinModal({ row, onClose, onSaved }: { row: AreaShopRow; onClose: () => void; onSaved: () => void }) {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(row.lat != null && row.lng != null ? { lat: row.lat, lng: row.lng } : null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal open onClose={onClose} title={`GPS pin: ${row.name}`} size="xl">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-neutral-600">Search for the shop, use your current location, or tap the map. The delivery area and times are worked out from this pin.</p>
        <LocationPicker lat={pos?.lat ?? null} lng={pos?.lng ?? null} onChange={(lat, lng) => setPos({ lat, lng })} />
        {error && <p className="text-sm font-medium text-blue-900">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!pos || pending}
            className={primaryButton}
            onClick={() =>
              start(async () => {
                if (!pos) return;
                const res = await setWarehouseLocation(row.id, pos.lat, pos.lng);
                if (res.error) setError(res.error);
                else onSaved();
              })
            }
          >
            {pending ? "Saving…" : "Save pin"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function RuleModal({ row, onClose, onSaved }: { row: AreaShopRow; onClose: () => void; onSaved: () => void }) {
  const [mode, setMode] = useState<"auto" | "off">(row.expressMode);
  const [maxKm, setMaxKm] = useState(row.expressMaxKm != null ? String(row.expressMaxKm) : "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal open onClose={onClose} title={`Express rule: ${row.name}`}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-neutral-600">By default a shop follows its area&apos;s rules. Use this only for an exception.</p>
        <Field label="Express for this shop">
          <Select value={mode} onChange={(e) => setMode(e.target.value === "off" ? "off" : "auto")} className="w-full">
            <option value="auto">Follow the area</option>
            <option value="off">Off for this shop (Standard only)</option>
          </Select>
        </Field>
        <Field label="Shorter Express distance (km)" hint="Leave empty to follow the area's limit. Cannot be longer than the area's limit.">
          <input type="number" min={0.1} max={100} step={0.5} value={maxKm} onChange={(e) => setMaxKm(e.target.value)} disabled={mode === "off"} placeholder="Follow the area" className={inputClass} />
        </Field>
        {error && <p className="text-sm font-medium text-blue-900">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            className={primaryButton}
            onClick={() =>
              start(async () => {
                const res = await setWarehouseExpressOverride(row.id, mode, maxKm.trim() === "" ? null : Number(maxKm));
                if (res.error) setError(res.error);
                else onSaved();
              })
            }
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

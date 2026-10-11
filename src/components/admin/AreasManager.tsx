"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import ZoneEditor from "@/components/admin/ZoneEditor";
import Select from "@/components/ui/Select";
import ArabicInput from "@/components/ui/ArabicInput";
import { Field, inputClass, primaryButton, secondaryButton } from "@/components/ui/Form";
import { deleteDeliveryArea, saveDeliveryArea } from "@/lib/actions/admin-areas";
import { polygonCenter, type LatLng } from "@/lib/geo-polygon";

export interface AreaCard {
  id: string;
  name: string;
  nameAr: string | null;
  polygon: LatLng[] | null;
  lat: number | null;
  lng: number | null;
  radiusKm: number | null;
  expressEnabled: boolean;
  standardEnabled: boolean;
  standardDays: number;
  logisticsEnabled: boolean;
  priority: number;
  shops: number;
  customers: number | null;
  color: string;
}

const EMPTY: Omit<AreaCard, "id" | "shops" | "customers" | "color"> = {
  name: "",
  nameAr: null,
  polygon: null,
  lat: null,
  lng: null,
  radiusKm: null,
  expressEnabled: true,
  standardEnabled: true,
  standardDays: 2,
  logisticsEnabled: false,
  priority: 0,
};

const ON_OFF = [
  { v: "on", l: "On" },
  { v: "off", l: "Off" },
];

function OnOff({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Select value={value ? "on" : "off"} onChange={(e) => onChange(e.target.value === "on")} className="w-full">
      {ON_OFF.map((o) => (
        <option key={o.v} value={o.v}>
          {o.l}
        </option>
      ))}
    </Select>
  );
}

export default function AreasManager({ areas }: { areas: AreaCard[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Partial<AreaCard> | null>(null);
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function remove(a: AreaCard) {
    if (!window.confirm(`Delete the zone "${a.name}"? Shops and customers inside it stop being covered unless another zone covers them.`)) return;
    startTransition(async () => {
      const res = await deleteDeliveryArea(a.id);
      setMessage(res.error ?? null);
      router.refresh();
    });
  }

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-base font-extrabold tracking-tight text-neutral-900">Zones</h2>
          <p className="mt-0.5 max-w-2xl text-xs text-neutral-500">
            {areas.length === 0
              ? "Add your first zone, for example a city. Until then each shop's own boundary below is used."
              : "Each zone has its own rules. Open one to change its shape, Express or Standard."}
          </p>
        </div>
        <button type="button" onClick={() => setEditing({ ...EMPTY })} className={primaryButton}>
          + Add zone
        </button>
      </div>

      {message && <p className="border-b border-neutral-100 bg-blue-50 px-4 py-2 text-sm text-blue-900">{message}</p>}

      {areas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 p-8 text-center">
          <span className="text-4xl">🗺️</span>
          <p className="font-semibold text-neutral-700">No zones yet</p>
          <p className="max-w-md text-sm text-neutral-500">Add your first zone, for example &ldquo;Riyadh&rdquo; or &ldquo;Kochi&rdquo;. As soon as one exists, zones take over from the per-shop boundaries.</p>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {areas.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: a.color }} />
              <div className="min-w-[10rem] flex-1">
                <p className="font-bold text-neutral-900">
                  {a.name}
                  {a.priority !== 0 && <span className="ms-2 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-500">priority {a.priority}</span>}
                </p>
                <p className="text-xs text-neutral-500">
                  {a.polygon ? `Drawn area, ${a.polygon.length} points` : `Circle, ${a.radiusKm} km radius`} · {a.shops} {a.shops === 1 ? "shop" : "shops"} inside
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
                <span className={`rounded-full px-2.5 py-1 ${a.expressEnabled ? "bg-blue-50 text-blue-800" : "bg-neutral-100 text-neutral-500"}`}>
                  {a.expressEnabled ? "Express in this zone" : "Express off"}
                </span>
                <span className={`rounded-full px-2.5 py-1 ${a.standardEnabled ? "bg-blue-50 text-blue-800" : "bg-neutral-100 text-neutral-500"}`}>
                  {a.standardEnabled ? `Standard ${a.standardDays} ${a.standardDays === 1 ? "day" : "days"}` : "Standard off"}
                </span>
              </div>
              <div className="ms-auto flex gap-2">
                <button type="button" onClick={() => setEditing(a)} className="h-9 rounded-full border border-neutral-300 px-4 text-xs font-bold text-neutral-700 hover:bg-neutral-50">
                  Edit
                </button>
                <button type="button" disabled={busy} onClick={() => remove(a)} className="h-9 rounded-full border border-neutral-300 px-4 text-xs font-bold text-neutral-500 hover:bg-neutral-50 disabled:opacity-50">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <AreaEditorModal
          key={editing.id ?? "new"}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

function AreaEditorModal({ initial, onClose, onSaved }: { initial: Partial<AreaCard>; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial.name ?? "");
  const [nameAr, setNameAr] = useState(initial.nameAr ?? "");
  const [expressEnabled, setExpressEnabled] = useState(initial.expressEnabled ?? true);
  const [standardEnabled, setStandardEnabled] = useState(initial.standardEnabled ?? true);
  const [standardDays, setStandardDays] = useState(String(initial.standardDays ?? 2));
  const [logistics, setLogistics] = useState(initial.logisticsEnabled ?? false);
  const [priority, setPriority] = useState(String(initial.priority ?? 0));

  const center = initial.polygon ? polygonCenter(initial.polygon) : null;
  const startLat = initial.lat ?? center?.[0] ?? null;
  const startLng = initial.lng ?? center?.[1] ?? null;

  return (
    <Modal open onClose={onClose} title={initial.id ? `Edit zone: ${initial.name}` : "Add a delivery zone"} size="xl">
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Zone name" required>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Riyadh North" className={inputClass} />
          </Field>
          <Field label="Name in Arabic">
            <ArabicInput english={name} value={nameAr} onChange={setNameAr} className={inputClass} />
          </Field>
          <Field label="Express delivery" hint="Express applies inside this zone: when the shop and the customer are both in it.">
            <OnOff value={expressEnabled} onChange={setExpressEnabled} />
          </Field>
          <Field label="Standard delivery">
            <OnOff value={standardEnabled} onChange={setStandardEnabled} />
          </Field>
          <Field label="Standard delivery days">
            <input type="number" min={0} max={30} step={1} value={standardDays} onChange={(e) => setStandardDays(e.target.value)} disabled={!standardEnabled} className={inputClass} />
          </Field>
          <Field label="Priority" hint="Where zones overlap, the higher number wins.">
            <input type="number" min={-100} max={100} step={1} value={priority} onChange={(e) => setPriority(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Third-party logistics" hint="Recorded for now. Booking couriers for far shops comes later.">
            <OnOff value={logistics} onChange={setLogistics} />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-neutral-800">Where is this zone?</p>
          <ZoneEditor
            warehouseId=""
            storeAddress={null}
            initialLat={startLat}
            initialLng={startLng}
            initialRadiusKm={initial.radiusKm ?? null}
            initialPolygon={initial.polygon ?? null}
            saveLabel={initial.id ? "Save zone" : "Create zone"}
            onSave={async (zone) => {
              const res = await saveDeliveryArea({
                id: initial.id,
                name,
                nameAr,
                shape: { polygon: zone.polygon, lat: zone.lat, lng: zone.lng, radiusKm: zone.radiusKm },
                expressEnabled,
                standardEnabled,
                standardDays: Number(standardDays),
                logisticsEnabled: logistics,
                priority: Number(priority),
              });
              if (res.error) throw new Error(res.error);
              onSaved();
            }}
          />
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={secondaryButton}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

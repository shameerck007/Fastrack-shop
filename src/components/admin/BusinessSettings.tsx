"use client";


import { unwrapAction } from "@/lib/errors";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/Link";
import PhoneNumberInput from "@/components/PhoneNumberInput";
import Select from "@/components/ui/Select";
import FormDialog, { DialogSection } from "@/components/ui/FormDialog";
import { Field, inputClass } from "@/components/ui/Form";
import { useMarket } from "@/components/MoneyProvider";
import { INDIAN_STATES } from "@/lib/india";
import { updateCompanySettings } from "@/lib/actions/admin-settings";
import { saveDefaultMaxOrderQty } from "@/lib/actions/admin-offers";
import type { CompanySettings } from "@/lib/company-settings";
import MapPinIcon from "@/components/MapPinIcon";

/** Every setting as the text typed in a box (or a switch), so each popup edits a few keys and saves them all together. */
interface Values {
  tradingName: string;
  crNumber: string;
  vatNumber: string;
  state: string;
  addressLine: string;
  district: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  riderRadius: string;
  payBase: string;
  payPerKm: string;
  dailyTarget: string;
  dailyBonus: string;
  autoDispatch: boolean;
  expressRadius: string;
  offerSeconds: string;
  prepMinutes: string;
  riderSpeed: string;
  etaBuffer: string;
  maxQty: string;
}

type SectionId = "company" | "address" | "contact" | "riders" | "express" | "eta" | "ordering";

function initial(s: CompanySettings): Values {
  return {
    tradingName: s.trading_name,
    crNumber: s.cr_number ?? "",
    vatNumber: s.vat_number ?? "",
    state: s.state ?? "",
    addressLine: s.address_line ?? "",
    district: s.district ?? "",
    city: s.city ?? "",
    postalCode: s.postal_code ?? "",
    phone: s.phone ?? "",
    email: s.email ?? "",
    riderRadius: String(s.rider_pickup_radius_km ?? 20),
    payBase: s.rider_pay_base == null ? "" : String(s.rider_pay_base),
    payPerKm: String(s.rider_pay_per_km ?? 0),
    dailyTarget: s.rider_daily_target == null ? "" : String(s.rider_daily_target),
    dailyBonus: String(s.rider_daily_bonus ?? 0),
    autoDispatch: s.express_auto_dispatch ?? true,
    expressRadius: String(s.express_rider_radius_km ?? 5),
    offerSeconds: String(s.express_offer_seconds ?? 30),
    prepMinutes: String(s.prep_minutes ?? 10),
    riderSpeed: String(s.rider_speed_kmh ?? 20),
    etaBuffer: String(s.eta_buffer_minutes ?? 5),
    maxQty: String(s.default_max_order_qty ?? 2),
  };
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <dt className="shrink-0 text-neutral-500">{label}</dt>
      <dd className={`min-w-0 truncate text-end font-semibold ${empty ? "font-normal text-neutral-500" : "text-neutral-900"}`}>{empty ? "Not set" : value}</dd>
    </div>
  );
}

function Card({ icon, title, hint, onEdit, children }: { icon: React.ReactNode; title: string; hint: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg">{icon}</span>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold tracking-tight text-neutral-900">{title}</h2>
            <p className="truncate text-xs text-neutral-500">{hint}</p>
          </div>
        </div>
        <button type="button" onClick={onEdit} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-neutral-300 px-3.5 text-xs font-bold text-neutral-700 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700">
          <span aria-hidden>✎</span> Edit
        </button>
      </div>
      <dl className="divide-y divide-neutral-100 border-t border-neutral-100">{children}</dl>
    </section>
  );
}

export default function BusinessSettings({ settings }: { settings: CompanySettings }) {
  const router = useRouter();
  const { countryCode } = useMarket();
  const isIndia = countryCode === "IN";
  const [v, setV] = useState<Values>(() => initial(settings));
  const [open, setOpen] = useState<SectionId | null>(null);
  const [draft, setDraft] = useState<Values>(v);
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setDraft((d) => ({ ...d, [k]: val }));

  function edit(id: SectionId) {
    setDraft(v);
    setOpen(id);
  }

  async function save(): Promise<string | void> {
    const d = draft;
    if (!d.tradingName.trim()) return "Trading name is required.";
    if (open === "ordering") {
      const res = await unwrapAction(saveDefaultMaxOrderQty)(Number(d.maxQty));
      if (res.error) return res.error;
    } else {
      await unwrapAction(updateCompanySettings)({
        tradingName: d.tradingName,
        crNumber: d.crNumber,
        vatNumber: d.vatNumber,
        addressLine: d.addressLine,
        city: d.city,
        district: d.district,
        postalCode: d.postalCode,
        phone: d.phone,
        email: d.email,
        state: d.state,
        riderPickupRadiusKm: Number(d.riderRadius) || undefined,
        prepMinutes: d.prepMinutes === "" ? undefined : Number(d.prepMinutes),
        riderSpeedKmh: Number(d.riderSpeed) || undefined,
        etaBufferMinutes: d.etaBuffer === "" ? undefined : Number(d.etaBuffer),
        expressAutoDispatch: d.autoDispatch,
        expressRiderRadiusKm: Number(d.expressRadius) || undefined,
        expressOfferSeconds: Number(d.offerSeconds) || undefined,
        riderPayBase: d.payBase.trim() === "" ? null : Number(d.payBase),
        riderPayPerKm: d.payPerKm.trim() === "" ? 0 : Number(d.payPerKm),
        riderDailyTarget: d.dailyTarget.trim() === "" ? null : Number(d.dailyTarget),
        riderDailyBonus: d.dailyBonus.trim() === "" ? 0 : Number(d.dailyBonus),
      });
    }
    setV(d);
    router.refresh();
  }

  const num = (s: string, unit: string) => (s === "" ? null : `${s} ${unit}`);
  const closeDialog = () => setOpen(null);

  return (
    <div className="flex flex-col gap-4">
      {!v.vatNumber && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <span aria-hidden className="text-lg">⚠️</span>
          <p>
            {isIndia ? "GSTIN isn't set yet, so invoices go out without a GST registration number. Add it before invoices go to real customers." : "The VAT number isn't set yet, so invoices go out without it. Add it before invoices go to real customers."}{" "}
            <button type="button" onClick={() => edit("company")} className="font-bold underline">
              Add it now
            </button>
          </p>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <Card icon="🏢" title="Company profile" hint={isIndia ? "Shown on every customer invoice" : "Shown on every customer invoice"} onEdit={() => edit("company")}>
          <Row label="Trading name" value={v.tradingName} />
          <Row label={isIndia ? "PAN" : "Commercial registration"} value={v.crNumber} />
          <Row label={isIndia ? "GSTIN" : "VAT number"} value={v.vatNumber} />
          {isIndia && <Row label="State" value={v.state} />}
        </Card>

        <Card icon={<MapPinIcon />} title="Registered address" hint="Printed on invoices" onEdit={() => edit("address")}>
          <Row label="Address" value={v.addressLine} />
          <Row label="District" value={v.district} />
          <Row label="City" value={v.city} />
          <Row label="Postal code" value={v.postalCode} />
        </Card>

        <Card icon="☎️" title="Contact" hint="How customers and suppliers reach FasTrack" onEdit={() => edit("contact")}>
          <Row label="Phone" value={v.phone} />
          <Row label="Email" value={v.email} />
        </Card>

        <Card icon="🛵" title="Riders and pay" hint="Who sees an order, and what a rider earns" onEdit={() => edit("riders")}>
          <Row label="Orders offered within" value={num(v.riderRadius, "km")} />
          <Row label="Pay per delivery" value={v.payBase === "" ? "The order's delivery fee" : v.payBase} />
          <Row label="Extra pay per km" value={v.payPerKm} />
          <Row label="Daily target bonus" value={v.dailyTarget === "" ? "Off" : `${v.dailyBonus} for ${v.dailyTarget} deliveries`} />
        </Card>

        <Card icon="⚡" title="Express dispatch" hint="Automatic rider offers for quick orders" onEdit={() => edit("express")}>
          <Row label="Automatic offers" value={v.autoDispatch ? "On" : "Off"} />
          <Row label="First offered within" value={num(v.expressRadius, "km")} />
          <Row label="Time to accept" value={num(v.offerSeconds, "seconds")} />
        </Card>

        <Card icon="⏱️" title="Delivery time shown to customers" hint="Packing + travel + extra minutes" onEdit={() => edit("eta")}>
          <Row label="Packing time" value={num(v.prepMinutes, "min")} />
          <Row label="Average rider speed" value={num(v.riderSpeed, "km/h")} />
          <Row label="Extra minutes" value={num(v.etaBuffer, "min")} />
        </Card>

        <Card icon="🛒" title="Ordering" hint="Limits and fees for orders" onEdit={() => edit("ordering")}>
          <Row label="Default maximum order quantity" value={`${v.maxQty} per product`} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 py-2 text-xs">
            <Link href="/admin/delivery-fees" className="font-semibold text-brand-700 hover:underline">
              Delivery fees →
            </Link>
            <Link href="/admin/offers" className="font-semibold text-brand-700 hover:underline">
              Offers &amp; coupons →
            </Link>
            <Link href="/admin/commission" className="font-semibold text-brand-700 hover:underline">
              Commission rates →
            </Link>
          </div>
        </Card>
      </div>

      {open === "company" && (
        <FormDialog icon="🏢" title="Company profile" subtitle="Shown on every customer invoice" onClose={closeDialog} onSave={save}>
          <DialogSection>
            <Field label="Trading name" required className="sm:col-span-2">
              <input required value={draft.tradingName} onChange={(e) => set("tradingName", e.target.value)} className={inputClass} />
            </Field>
            <Field label={isIndia ? "PAN" : "Commercial registration (CR) number"}>
              <input value={draft.crNumber} onChange={(e) => set("crNumber", e.target.value)} placeholder="Not set" className={inputClass} />
            </Field>
            <Field label={isIndia ? "GSTIN" : "VAT number"}>
              <input value={draft.vatNumber} onChange={(e) => set("vatNumber", e.target.value)} placeholder={isIndia ? "27ABCDE1234F1Z5" : "Not set"} className={inputClass} />
            </Field>
            {isIndia && (
              <Field label="State" hint="Decides CGST + SGST or IGST on invoices." className="sm:col-span-2">
                <Select value={draft.state} onChange={(e) => set("state", e.target.value)} className="w-full">
                  <option value="">Select state</option>
                  {INDIAN_STATES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </DialogSection>
        </FormDialog>
      )}

      {open === "address" && (
        <FormDialog icon={<MapPinIcon />} title="Registered address" subtitle="Printed on invoices" onClose={closeDialog} onSave={save}>
          <DialogSection>
            <Field label="Address line" className="sm:col-span-2">
              <input value={draft.addressLine} onChange={(e) => set("addressLine", e.target.value)} className={inputClass} />
            </Field>
            <Field label="District">
              <input value={draft.district} onChange={(e) => set("district", e.target.value)} className={inputClass} />
            </Field>
            <Field label="City">
              <input value={draft.city} onChange={(e) => set("city", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Postal code">
              <input value={draft.postalCode} onChange={(e) => set("postalCode", e.target.value)} className={inputClass} />
            </Field>
          </DialogSection>
        </FormDialog>
      )}

      {open === "contact" && (
        <FormDialog icon="☎️" title="Contact" subtitle="How customers and suppliers reach FasTrack" onClose={closeDialog} onSave={save}>
          <DialogSection>
            <Field label="Phone">
              <PhoneNumberInput value={draft.phone} onChange={(p) => set("phone", p)} placeholder="Not set" />
            </Field>
            <Field label="Email">
              <input type="email" value={draft.email} onChange={(e) => set("email", e.target.value)} className={inputClass} />
            </Field>
          </DialogSection>
        </FormDialog>
      )}

      {open === "riders" && (
        <FormDialog icon="🛵" title="Riders and pay" subtitle="Who sees an order, and what a rider earns" onClose={closeDialog} onSave={save}>
          <DialogSection title="Who is offered orders">
            <Field label="Orders offered to riders within (km)" hint="A rider online within this distance of a shop sees its new orders and gets a notification." className="sm:col-span-2">
              <input type="number" min={1} max={200} step={1} value={draft.riderRadius} onChange={(e) => set("riderRadius", e.target.value)} className={inputClass} />
            </Field>
          </DialogSection>
          <DialogSection title="What a rider earns" hint="Separate from what the customer pays. Fixed when a rider takes the order, so a change only affects new orders.">
            <Field label="Pay per delivery" hint="Empty = riders earn the order's delivery fee.">
              <input type="number" min={0} step={0.5} value={draft.payBase} onChange={(e) => set("payBase", e.target.value)} placeholder="Delivery fee" className={inputClass} />
            </Field>
            <Field label="Extra pay per km" hint="Road distance from the shop to the customer.">
              <input type="number" min={0} step={0.5} value={draft.payPerKm} onChange={(e) => set("payPerKm", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Daily target (deliveries)" hint="Empty = no bonus.">
              <input type="number" min={1} max={200} value={draft.dailyTarget} onChange={(e) => set("dailyTarget", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Bonus when the target is reached" hint="Added once per rider per day.">
              <input type="number" min={0} step={0.5} value={draft.dailyBonus} onChange={(e) => set("dailyBonus", e.target.value)} className={inputClass} />
            </Field>
          </DialogSection>
        </FormDialog>
      )}

      {open === "express" && (
        <FormDialog icon="⚡" title="Express dispatch" subtitle="Automatic rider offers for quick orders" onClose={closeDialog} onSave={save}>
          <DialogSection title="How offers work" hint="Express orders go to one rider at a time: the nearest free rider within the distance below. If they decline or time runs out, the next nearest is offered, and the distance grows each time up to the general rider distance." cols={1}>
            <label className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
              <input type="checkbox" checked={draft.autoDispatch} onChange={(e) => set("autoDispatch", e.target.checked)} className="h-4 w-4 accent-brand-700" />
              Offer Express orders automatically
            </label>
          </DialogSection>
          <DialogSection>
            <Field label="First offered to riders within (km)">
              <input type="number" min={0.5} max={200} step={0.5} value={draft.expressRadius} onChange={(e) => set("expressRadius", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Time to accept an offer (seconds)">
              <input type="number" min={10} max={300} value={draft.offerSeconds} onChange={(e) => set("offerSeconds", e.target.value)} className={inputClass} />
            </Field>
          </DialogSection>
        </FormDialog>
      )}

      {open === "eta" && (
        <FormDialog icon="⏱️" title="Delivery time shown to customers" subtitle="Packing time + rider travel + extra minutes" onClose={closeDialog} onSave={save}>
          <DialogSection cols={3}>
            <Field label="Packing time (minutes)">
              <input type="number" min={0} max={120} value={draft.prepMinutes} onChange={(e) => set("prepMinutes", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Average rider speed (km/h)">
              <input type="number" min={5} max={80} value={draft.riderSpeed} onChange={(e) => set("riderSpeed", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Extra minutes" hint="For the rider to reach the store.">
              <input type="number" min={0} max={60} value={draft.etaBuffer} onChange={(e) => set("etaBuffer", e.target.value)} className={inputClass} />
            </Field>
          </DialogSection>
        </FormDialog>
      )}

      {open === "ordering" && (
        <FormDialog icon="🛒" title="Ordering" subtitle="Applies to new products" onClose={closeDialog} onSave={save}>
          <DialogSection cols={1}>
            <Field label="Default maximum order quantity" required hint="The most of one product a customer can put in an order. New products start with this number; a supplier or FasTrack can change it for any product.">
              <input type="number" min={1} step={1} required value={draft.maxQty} onChange={(e) => set("maxQty", e.target.value.replace(/[^0-9]/g, ""))} className={`${inputClass} sm:w-40`} />
            </Field>
          </DialogSection>
        </FormDialog>
      )}
    </div>
  );
}

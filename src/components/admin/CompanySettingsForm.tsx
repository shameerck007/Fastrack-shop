"use client";

import PhoneNumberInput from "@/components/PhoneNumberInput";
import { useMarket } from "@/components/MoneyProvider";
import { INDIAN_STATES } from "@/lib/india";

import { useState, useTransition } from "react";
import { updateCompanySettings } from "@/lib/actions/admin-settings";
import { useLocale } from "@/components/LocaleProvider";
import type { CompanySettings } from "@/lib/company-settings";

export default function CompanySettingsForm({ settings }: { settings: CompanySettings }) {
  const { t } = useLocale();
  const [tradingName, setTradingName] = useState(settings.trading_name);
  const [crNumber, setCrNumber] = useState(settings.cr_number ?? "");
  const [vatNumber, setVatNumber] = useState(settings.vat_number ?? "");
  const [addressLine, setAddressLine] = useState(settings.address_line ?? "");
  const [city, setCity] = useState(settings.city ?? "");
  const [district, setDistrict] = useState(settings.district ?? "");
  const [postalCode, setPostalCode] = useState(settings.postal_code ?? "");
  const [phone, setPhone] = useState(settings.phone ?? "");
  const [email, setEmail] = useState(settings.email ?? "");
  const [stateName, setStateName] = useState(settings.state ?? "");
  const [riderRadius, setRiderRadius] = useState(String(settings.rider_pickup_radius_km ?? 20));
  const [prepMinutes, setPrepMinutes] = useState(String(settings.prep_minutes ?? 10));
  const [riderSpeed, setRiderSpeed] = useState(String(settings.rider_speed_kmh ?? 20));
  const [etaBuffer, setEtaBuffer] = useState(String(settings.eta_buffer_minutes ?? 5));
  const { countryCode } = useMarket();
  const isIndia = countryCode === "IN";
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updateCompanySettings({
          tradingName,
          crNumber,
          vatNumber,
          addressLine,
          city,
          district,
          postalCode,
          phone,
          email,
          state: stateName,
          riderPickupRadiusKm: Number(riderRadius) || undefined,
          prepMinutes: prepMinutes === "" ? undefined : Number(prepMinutes),
          riderSpeedKmh: Number(riderSpeed) || undefined,
          etaBufferMinutes: etaBuffer === "" ? undefined : Number(etaBuffer),
        });
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("admin.could_not_save_settings"));
      }
    });
  }

  const field = "rounded-lg border border-neutral-300 px-3 py-2 text-sm";
  const label = "mb-1 block text-xs font-medium text-neutral-500";

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <p className="-mt-3 text-sm text-neutral-500">
        {isIndia
          ? "FasTrack's own trading name, PAN, GSTIN, address and contact details, shown on every customer invoice."
          : t("admin.business_settings_intro")}
      </p>

      {!settings.vat_number && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {isIndia
            ? "GSTIN isn't set yet, so invoices go out without a GST registration number. Set it below before invoices go to real customers."
            : t("admin.vat_not_set_warning")}
        </div>
      )}

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">{t("admin.trading_details")}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>{t("admin.trading_name")}</label>
            <input required value={tradingName} onChange={(e) => setTradingName(e.target.value)} className={`${field} w-full`} />
          </div>
          <div>
            <label className={label}>{isIndia ? "PAN" : t("admin.cr_number")}</label>
            <input value={crNumber} onChange={(e) => setCrNumber(e.target.value)} placeholder={t("admin.not_set_placeholder")} className={`${field} w-full`} />
          </div>
          <div>
            <label className={label}>{isIndia ? "GSTIN" : t("admin.vat_number")}</label>
            <input value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} placeholder={isIndia ? "27ABCDE1234F1Z5" : t("admin.vat_placeholder")} className={`${field} w-full`} />
          </div>
          {isIndia && (
            <div>
              <label className={label}>State (decides CGST + SGST or IGST on invoices)</label>
              <select value={stateName} onChange={(e) => setStateName(e.target.value)} className={`${field} w-full bg-white`}>
                <option value="">Select state</option>
                {INDIAN_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Riders</h2>
        <label className={label}>How far from the pickup point a rider is offered orders (km)</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={200}
            step={1}
            value={riderRadius}
            onChange={(e) => setRiderRadius(e.target.value)}
            className={`${field} w-28`}
          />
          <span className="text-sm text-neutral-500">km (default 20)</span>
        </div>
        <p className="mt-1 text-xs text-neutral-400">A rider online within this distance of a shop or warehouse sees its new orders and gets a push notification.</p>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-neutral-700">Delivery time shown to customers</h2>
        <p className="mb-3 text-xs text-neutral-400">
          Estimated time = packing time + rider travel (distance, at the speed below) + extra minutes. Shown as a range, for example 20–25 min.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={label}>Packing time (minutes)</label>
            <input type="number" min={0} max={120} value={prepMinutes} onChange={(e) => setPrepMinutes(e.target.value)} className={`${field} w-full`} />
          </div>
          <div>
            <label className={label}>Average rider speed (km/h)</label>
            <input type="number" min={5} max={80} value={riderSpeed} onChange={(e) => setRiderSpeed(e.target.value)} className={`${field} w-full`} />
          </div>
          <div>
            <label className={label}>Extra minutes (rider reaches the store)</label>
            <input type="number" min={0} max={60} value={etaBuffer} onChange={(e) => setEtaBuffer(e.target.value)} className={`${field} w-full`} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">{t("admin.registered_address")}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>{t("admin.address_line")}</label>
            <input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} placeholder={t("admin.not_set_placeholder")} className={`${field} w-full`} />
          </div>
          <div>
            <label className={label}>{t("admin.district")}</label>
            <input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder={t("admin.not_set_placeholder")} className={`${field} w-full`} />
          </div>
          <div>
            <label className={label}>{t("admin.city")}</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("admin.not_set_placeholder")} className={`${field} w-full`} />
          </div>
          <div>
            <label className={label}>{t("admin.postal_code")}</label>
            <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder={t("admin.not_set_placeholder")} className={`${field} w-full`} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">{t("admin.contact_information")}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>{t("admin.contact_phone")}</label>
            <PhoneNumberInput value={phone} onChange={setPhone} placeholder={t("admin.not_set_placeholder")} />
          </div>
          <div>
            <label className={label}>{t("admin.contact_email")}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("admin.not_set_placeholder")} className={`${field} w-full`} />
          </div>
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && !error && <p className="text-sm text-emerald-600">{t("admin.settings_saved")}</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-blue-700 px-5 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? t("common.saving") : t("admin.save_settings")}
      </button>
    </form>
  );
}

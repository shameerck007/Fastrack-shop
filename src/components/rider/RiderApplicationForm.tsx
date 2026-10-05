"use client";

import PhoneNumberInput from "@/components/PhoneNumberInput";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyAsRider } from "@/lib/actions/rider-application";
import RiderDocumentUploader from "@/components/rider/RiderDocumentUploader";
import { useLocale } from "@/components/LocaleProvider";

export default function RiderApplicationForm() {
  const { t } = useLocale();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState("motorbike");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseDocumentPath, setLicenseDocumentPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!licenseDocumentPath) {
      setError(t("become_rider.license_required"));
      return;
    }
    startTransition(async () => {
      try {
        await applyAsRider({ fullName, phone, vehicleType, licenseNumber, licenseDocumentPath });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("become_rider.could_not_submit"));
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5">
      <div>
        <label className="mb-1 block text-sm font-medium">{t("become_rider.full_name")}</label>
        <input
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{t("become_rider.phone")}</label>
        <PhoneNumberInput required value={phone} onChange={setPhone} placeholder="5X XXX XXXX" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{t("become_rider.vehicle_type")}</label>
        <select
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="motorbike">{t("become_rider.vehicle_motorbike")}</option>
          <option value="car">{t("become_rider.vehicle_car")}</option>
          <option value="bicycle">{t("become_rider.vehicle_bicycle")}</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{t("become_rider.license_number")}</label>
        <input
          required
          value={licenseNumber}
          onChange={(e) => setLicenseNumber(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      <RiderDocumentUploader
        label={t("become_rider.license_document")}
        value={licenseDocumentPath}
        onChange={setLicenseDocumentPath}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 self-start rounded-full bg-blue-700 px-6 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? t("become_rider.submitting") : t("become_rider.submit_application")}
      </button>
    </form>
  );
}

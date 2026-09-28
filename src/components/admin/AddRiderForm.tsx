"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { findUserByEmail, isAlreadyRider, adminCreateRider, type FoundUser } from "@/lib/actions/admin-riders";
import { useLocale } from "@/components/LocaleProvider";

export default function AddRiderForm() {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<FoundUser | null | undefined>(undefined); // undefined = not searched yet
  const [alreadyRider, setAlreadyRider] = useState(false);
  const [searching, startSearch] = useTransition();
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const [vehicleType, setVehicleType] = useState("motorbike");
  const [licenseNumber, setLicenseNumber] = useState("");

  function reset() {
    setEmail("");
    setFound(undefined);
    setAlreadyRider(false);
    setError(null);
    setVehicleType("motorbike");
    setLicenseNumber("");
  }

  function close() {
    setOpen(false);
    reset();
  }

  function search() {
    setError(null);
    startSearch(async () => {
      try {
        const user = await findUserByEmail(email);
        setFound(user);
        if (!user) {
          setError(t("add_rider.no_account"));
          return;
        }
        const already = await isAlreadyRider(user.id);
        setAlreadyRider(already);
        if (already) setError(t("add_rider.already_a_rider"));
      } catch (err) {
        setError(err instanceof Error ? err.message : t("add_rider.lookup_failed"));
      }
    });
  }

  function submit() {
    if (!found) return;
    if (!licenseNumber.trim()) {
      setError(t("add_rider.license_required"));
      return;
    }
    setError(null);
    startSave(async () => {
      try {
        const riderId = await adminCreateRider({
          userId: found.id,
          vehicleType,
          licenseNumber: licenseNumber.trim(),
        });
        close();
        router.push(`/admin/riders/${riderId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("add_rider.could_not_create"));
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-800"
      >
        {t("add_rider.add_rider_btn")}
      </button>

      <Modal open={open} onClose={close} title={t("add_rider.add_rider_title")} size="md">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-neutral-500">{t("add_rider.intro")}</p>

          <div className="flex gap-2">
            <input
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFound(undefined);
                setAlreadyRider(false);
                setError(null);
              }}
              placeholder={t("add_rider.rider_email_placeholder")}
              type="email"
              className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <button
              onClick={search}
              disabled={!email.trim() || searching}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
            >
              {searching ? t("add_rider.searching") : t("add_rider.find")}
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {found && !alreadyRider && (
            <>
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {t("add_rider.found_account", { name: found.fullName ?? t("add_rider.unnamed_account"), role: found.role })}
              </p>

              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="motorbike">{t("become_rider.vehicle_motorbike")}</option>
                <option value="car">{t("become_rider.vehicle_car")}</option>
                <option value="bicycle">{t("become_rider.vehicle_bicycle")}</option>
              </select>
              <input
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder={t("add_rider.license_number")}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />

              <button
                onClick={submit}
                disabled={saving}
                className="mt-1 rounded-full bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {saving ? t("add_rider.creating") : t("add_rider.create_rider")}
              </button>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}

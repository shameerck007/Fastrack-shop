"use client";

import TaxIdInput from "@/components/TaxIdInput";
import { checkCrNumber, checkVatNumber } from "@/lib/saudi-tax";
import PhoneNumberInput from "@/components/PhoneNumberInput";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { findUserByEmail, adminCreateMerchant, type FoundUser } from "@/lib/actions/admin-merchants";
import { useLocale } from "@/components/LocaleProvider";

const COUNTRIES = ["Saudi Arabia", "United Arab Emirates", "Kuwait", "Bahrain", "Qatar", "Oman", "India"];

export default function AddMerchantForm() {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<FoundUser | null | undefined>(undefined); // undefined = not searched yet
  const [searching, startSearch] = useTransition();
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const [name, setName] = useState("");
  const [crNumber, setCrNumber] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("Riyadh");
  const [country, setCountry] = useState("Saudi Arabia");

  function reset() {
    setEmail("");
    setFound(undefined);
    setError(null);
    setName("");
    setCrNumber("");
    setVatNumber("");
    setContactPhone("");
    setAddressLine("");
    setCity("Riyadh");
    setCountry("Saudi Arabia");
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
        if (!user) setError(t("add_merchant.no_account"));
        else if (user.hasStore) setError(t("add_merchant.already_has_store"));
      } catch (err) {
        setError(err instanceof Error ? err.message : t("add_merchant.lookup_failed"));
      }
    });
  }

  function submit() {
    if (!found) return;
    if (!name.trim() || !crNumber.trim()) {
      setError(t("add_merchant.name_cr_required"));
      return;
    }
    if (country.trim().toLowerCase() === "saudi arabia") {
      const cr = checkCrNumber(crNumber);
      const vat = checkVatNumber(vatNumber);
      const problem = cr.error ?? vat.error;
      if (problem) {
        setError(problem);
        return;
      }
    }
    setError(null);
    startSave(async () => {
      try {
        const storeId = await adminCreateMerchant({
          ownerId: found.id,
          name: name.trim(),
          crNumber: crNumber.trim(),
          vatNumber: vatNumber.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          addressLine: addressLine.trim() || undefined,
          city: city.trim() || "Riyadh",
          country,
        });
        close();
        router.push(`/admin/merchants/${storeId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("add_merchant.could_not_create"));
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-800"
      >
        {t("add_merchant.add_merchant_btn")}
      </button>

      <Modal open={open} onClose={close} title={t("add_merchant.add_merchant_title")} size="md">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-neutral-500">{t("add_merchant.intro")}</p>

          <div className="flex gap-2">
            <input
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFound(undefined);
                setError(null);
              }}
              placeholder={t("add_merchant.owner_email_placeholder")}
              type="email"
              className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <button
              onClick={search}
              disabled={!email.trim() || searching}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
            >
              {searching ? t("add_merchant.searching") : t("add_merchant.find")}
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {found && !found.hasStore && (
            <>
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {t("add_merchant.found_account", { name: found.fullName ?? t("add_merchant.unnamed_account"), role: found.role })}
              </p>

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("add_merchant.store_name")}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                {country.trim().toLowerCase() === "saudi arabia" ? (
                  <>
                    <TaxIdInput value={crNumber} onChange={setCrNumber} check={checkCrNumber} length={10} placeholder={t("add_merchant.cr_number")} />
                    <TaxIdInput value={vatNumber} onChange={setVatNumber} check={checkVatNumber} length={15} placeholder={t("add_merchant.vat_number_optional")} />
                  </>
                ) : (
                  <>
                    <input
                      value={crNumber}
                      onChange={(e) => setCrNumber(e.target.value)}
                      placeholder={t("add_merchant.cr_number")}
                      className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    />
                    <input
                      value={vatNumber}
                      onChange={(e) => setVatNumber(e.target.value)}
                      placeholder={t("add_merchant.vat_number_optional")}
                      className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    />
                  </>
                )}
              </div>
              <PhoneNumberInput value={contactPhone} onChange={setContactPhone} placeholder={t("add_merchant.contact_phone_optional")} />
              <input
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                placeholder={t("add_merchant.address_optional")}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={t("add_merchant.city")}
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={submit}
                disabled={saving}
                className="mt-1 rounded-full bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {saving ? t("add_merchant.creating") : t("add_merchant.create_merchant")}
              </button>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAddress, setDefaultAddress } from "@/lib/actions/addresses";
import AddressForm from "@/components/AddressForm";
import { useLocale } from "@/components/LocaleProvider";
import type { Address } from "@/types/database";
import { useMarket } from "@/components/MoneyProvider";
import { stateInServiceArea } from "@/lib/india";

export default function AddressCard({ address }: { address: Address }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { t } = useLocale();
  const countryCode = useMarket().countryCode;

  if (editing) {
    return <AddressForm existing={address} onDone={() => setEditing(false)} />;
  }

  const labelText =
    address.label === "home" ? t("addresses.label_home") : address.label === "office" ? t("addresses.label_office") : t("addresses.label_other");

  const nationalParts = [
    address.district,
    address.building_number && `${t("addresses.bldg_short")} ${address.building_number}`,
    address.additional_number && `${t("addresses.addl_short")} ${address.additional_number}`,
    address.unit_number && `${t("addresses.unit_short")} ${address.unit_number}`,
    address.postal_code,
  ].filter(Boolean);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium">
              {labelText}
            </span>
            {address.is_default && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{t("addresses.default")}</span>
            )}
          </div>
          {address.receiver_name && (
            <p className="mt-1 text-sm font-medium">
              {address.receiver_name}
              {address.receiver_phone && (
                <span className="ms-2 font-normal text-neutral-500">📞 {address.receiver_phone}</span>
              )}
            </p>
          )}
          <p className="mt-1 text-sm">{address.address_line}</p>
          {!stateInServiceArea(countryCode, (address as { state?: string | null }).state) && (
            <p className="mt-1 text-xs font-medium text-red-600">We don&apos;t deliver here yet (Kerala only for now).</p>
          )}
          {nationalParts.length > 0 && (
            <p className="text-xs text-neutral-500">{nationalParts.join(" · ")}</p>
          )}
          <p className="text-xs text-neutral-500">{address.city}</p>
          {address.short_address && (
            <p className="text-xs text-neutral-400">{t("addresses.national_address", { code: address.short_address })}</p>
          )}
          {address.lat != null && address.lng != null && (
            <p className="text-xs text-neutral-400">{t("addresses.location_pinned")}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
          <button onClick={() => setEditing(true)} className="text-blue-600 hover:underline">
            {t("addresses.edit")}
          </button>
          {!address.is_default && (
            <button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await setDefaultAddress(address.id);
                  router.refresh();
                })
              }
              className="text-blue-600 hover:underline disabled:opacity-50"
            >
              {t("addresses.set_as_default")}
            </button>
          )}
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                if (!confirm(t("addresses.confirm_delete"))) return;
                await deleteAddress(address.id);
                router.refresh();
              })
            }
            className="text-red-600 hover:underline disabled:opacity-50"
          >
            {t("addresses.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}

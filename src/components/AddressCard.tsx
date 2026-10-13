"use client";


import { unwrapAction } from "@/lib/errors";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAddress, setDefaultAddress } from "@/lib/actions/addresses";
import AddressForm from "@/components/AddressForm";
import { useLocale } from "@/components/LocaleProvider";
import type { Address } from "@/types/database";
import { useMarket } from "@/components/MoneyProvider";
import { stateInServiceArea } from "@/lib/india";
import { useDialogs } from "@/components/ui/Dialogs";

const ICON: Record<string, string> = { home: "🏠", office: "🏢", other: "📍" };

export default function AddressCard({ address }: { address: Address }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const { confirm: ask } = useDialogs();
  const router = useRouter();
  const { t } = useLocale();
  const countryCode = useMarket().countryCode;

  const labelText =
    address.label === "home" ? t("addresses.label_home") : address.label === "office" ? t("addresses.label_office") : t("addresses.label_other");

  const nationalParts = [
    address.district,
    address.building_number && `${t("addresses.bldg_short")} ${address.building_number}`,
    address.additional_number && `${t("addresses.addl_short")} ${address.additional_number}`,
    address.unit_number && `${t("addresses.unit_short")} ${address.unit_number}`,
    address.postal_code,
    address.city,
  ].filter(Boolean);

  const outside = !stateInServiceArea(countryCode, (address as { state?: string | null }).state);

  return (
    <div className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${address.is_default ? "border-brand-300 ring-1 ring-brand-100" : "border-neutral-200"}`}>
      <div className="flex gap-3 p-4">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl ${address.is_default ? "bg-brand-100" : "bg-neutral-100"}`}>{ICON[address.label] ?? "📍"}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-extrabold text-neutral-900">{labelText}</p>
            {address.is_default && <span className="rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">{t("addresses.default")}</span>}
            {address.lat != null && address.lng != null && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">✓ {t("addresses.location_pinned")}</span>}
          </div>
          <p className="mt-1 text-sm text-neutral-800">{address.address_line}</p>
          {nationalParts.length > 0 && <p className="text-xs text-neutral-500">{nationalParts.join(" · ")}</p>}
          {address.short_address && <p className="text-xs text-neutral-500">{t("addresses.national_address", { code: address.short_address })}</p>}
          {address.receiver_name && (
            <p className="mt-2 text-xs font-medium text-neutral-600">
              👤 {address.receiver_name}
              {address.receiver_phone && <span className="ms-2 font-normal text-neutral-500">📞 {address.receiver_phone}</span>}
            </p>
          )}
          {outside && <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700">We don&apos;t deliver here yet (Kerala only for now).</p>}
        </div>
      </div>
      <div className="flex divide-x divide-neutral-100 border-t border-neutral-100 text-sm font-semibold rtl:divide-x-reverse">
        <button onClick={() => setEditing(true)} className="flex-1 py-2.5 text-brand-700 transition hover:bg-brand-50">
          ✎ {t("addresses.edit")}
        </button>
        {!address.is_default && (
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await unwrapAction(setDefaultAddress)(address.id);
                router.refresh();
              })
            }
            className="flex-1 py-2.5 text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
          >
            {t("addresses.set_as_default")}
          </button>
        )}
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              if (!(await ask({ title: t("addresses.confirm_delete"), confirmLabel: "Delete", danger: true }))) return;
              await unwrapAction(deleteAddress)(address.id);
              router.refresh();
            })
          }
          className="flex-1 py-2.5 text-red-700 transition hover:bg-red-50 disabled:opacity-50"
        >
          {t("addresses.delete")}
        </button>
      </div>
      {editing && <AddressForm existing={address} onDone={() => setEditing(false)} />}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import AddressForm from "@/components/AddressForm";
import { placeOrder } from "@/lib/actions/orders";
import { formatSAR, extractVat } from "@/lib/utils";
import { useLocale } from "@/components/LocaleProvider";
import type { Address, DeliveryType, PaymentMethod } from "@/types/database";

const DELIVERY_OPTIONS: { value: DeliveryType; labelKey: string; hintKey: string; fee: number }[] = [
  { value: "express", labelKey: "checkout.express", hintKey: "checkout.minutes_15_30", fee: 12 },
  { value: "standard", labelKey: "checkout.standard", hintKey: "checkout.minutes_30_60", fee: 7 },
  { value: "scheduled", labelKey: "checkout.scheduled", hintKey: "checkout.choose_datetime", fee: 7 },
];

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "mada", label: "Mada" },
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "apple_pay", label: "Apple Pay" },
  { value: "cash_on_delivery", label: "Cash on Delivery" },
];

export default function CheckoutForm({
  addresses,
  subtotal,
  blockedByAddress = {},
}: {
  addresses: Address[];
  subtotal: number;
  blockedByAddress?: Record<string, string[]>;
}) {
  const { t, locale } = useLocale();
  // null means "no explicit user selection yet" — fall back to the first
  // address, which also picks up addresses added after this component mounted
  // (the addresses prop refreshes via server-action revalidation).
  const [selectedAddressId, setAddressId] = useState<string | null>(null);
  const addressId =
    selectedAddressId && addresses.some((a) => a.id === selectedAddressId)
      ? selectedAddressId
      : addresses[0]?.id ?? "";
  const blockedItems = blockedByAddress[addressId] ?? [];
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("standard");
  const [scheduledFor, setScheduledFor] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash_on_delivery");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const deliveryFee =
    subtotal >= 50 ? 0 : DELIVERY_OPTIONS.find((d) => d.value === deliveryType)!.fee;
  // Item prices already include VAT — this is the included tax portion for
  // the breakdown, not an amount added on top of subtotal.
  const vat = extractVat(subtotal);
  const total = Math.round((subtotal + deliveryFee) * 100) / 100;

  function handlePlaceOrder() {
    setError(null);
    if (!addressId) {
      setError(t("checkout.select_address_error"));
      return;
    }
    if (blockedItems.length > 0) {
      setError(t("checkout.cant_deliver_items", { items: blockedItems.join(locale === "ar" ? "، " : ", ") }));
      return;
    }
    startTransition(async () => {
      try {
        await placeOrder({
          addressId,
          deliveryType,
          scheduledFor: deliveryType === "scheduled" ? scheduledFor : undefined,
          paymentMethod,
        });
      } catch (err) {
        // Next.js redirect() throws an object with a NEXT_REDIRECT digest — rethrow so navigation still happens.
        const digest = (err as { digest?: string } | null)?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw err;
        setError(err instanceof Error ? err.message : t("checkout.could_not_place_order"));
      }
    });
  }

  const listSep = locale === "ar" ? "، " : ", ";

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 font-medium">{t("checkout.delivery_address")}</h2>
        <div className="flex flex-col gap-2">
          {addresses.map((addr) => (
            <label
              key={addr.id}
              className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${
                addressId === addr.id ? "border-blue-600 bg-blue-50" : "border-neutral-200"
              }`}
            >
              <input
                type="radio"
                name="address"
                checked={addressId === addr.id}
                onChange={() => setAddressId(addr.id)}
              />
              <span className="flex flex-col gap-0.5">
                <span className="flex items-center gap-2">
                  <span className="font-medium capitalize">
                    {addr.label === "home"
                      ? t("addresses.label_home")
                      : addr.label === "office"
                        ? t("addresses.label_office")
                        : t("addresses.label_other")}
                  </span>
                  {addr.short_address && (
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-600">
                      {addr.short_address}
                    </span>
                  )}
                </span>
                {addr.receiver_name && (
                  <span className="font-medium">
                    {addr.receiver_name}
                    {addr.receiver_phone && (
                      <span className="ms-2 font-normal text-neutral-500">📞 {addr.receiver_phone}</span>
                    )}
                  </span>
                )}
                <span>{addr.address_line}</span>
                <span className="text-xs text-neutral-500">
                  {[
                    addr.building_number && `${t("addresses.bldg_short")} ${addr.building_number}`,
                    addr.unit_number && `${t("addresses.unit_short")} ${addr.unit_number}`,
                    addr.district,
                    addr.city,
                    addr.postal_code,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
                {blockedByAddress[addr.id] ? (
                  <span className="text-xs font-medium text-red-600">
                    {t("checkout.outside_delivery_area", { items: blockedByAddress[addr.id].join(listSep) })}
                  </span>
                ) : addr.lat != null && addr.lng != null ? (
                  <span className="text-xs text-emerald-600">{t("checkout.map_pinned_deliverable")}</span>
                ) : null}
              </span>
            </label>
          ))}

          <div className="pt-1">
            <AddressForm
              onAdded={setAddressId}
              triggerLabel={addresses.length === 0 ? t("checkout.add_delivery_address") : t("common.add_new_address")}
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-medium">{t("checkout.delivery_time")}</h2>
        <div className="flex flex-col gap-2">
          {DELIVERY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 text-sm ${
                deliveryType === opt.value ? "border-blue-600 bg-blue-50" : "border-neutral-200"
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="delivery"
                  checked={deliveryType === opt.value}
                  onChange={() => setDeliveryType(opt.value)}
                />
                <span>
                  <span className="font-medium">{t(opt.labelKey)}</span>{" "}
                  <span className="text-neutral-500">— {t(opt.hintKey)}</span>
                </span>
              </span>
              <span>{subtotal >= 50 ? t("checkout.free") : formatSAR(opt.fee)}</span>
            </label>
          ))}
          {deliveryType === "scheduled" && (
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-medium">{t("checkout.payment")}</h2>
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${
                paymentMethod === opt.value ? "border-blue-600 bg-blue-50" : "border-neutral-200"
              }`}
            >
              <input
                type="radio"
                name="payment"
                checked={paymentMethod === opt.value}
                onChange={() => setPaymentMethod(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-1 rounded-xl border border-neutral-200 bg-white p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-neutral-500">{t("checkout.subtotal_incl_vat")}</span>
          <span>{formatSAR(subtotal)}</span>
        </div>
        <div className="flex justify-between ps-3 text-xs">
          <span className="text-neutral-400">{t("checkout.of_which_vat")}</span>
          <span className="text-neutral-400">{formatSAR(vat)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">{t("checkout.delivery_fee")}</span>
          <span>{deliveryFee === 0 ? t("checkout.free") : formatSAR(deliveryFee)}</span>
        </div>
        <div className="flex justify-between border-t border-neutral-200 pt-1 font-semibold">
          <span>{t("checkout.total")}</span>
          <span>{formatSAR(total)}</span>
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={handlePlaceOrder}
        disabled={pending || blockedItems.length > 0}
        className="rounded-full bg-blue-700 py-3 font-medium text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? t("checkout.placing_order") : t("checkout.place_order_with_total", { total: formatSAR(total) })}
      </button>
      {blockedItems.length > 0 && (
        <p className="-mt-3 text-center text-sm text-red-600">
          {t("checkout.some_items_blocked", { items: blockedItems.join(listSep) })}
        </p>
      )}
    </div>
  );
}

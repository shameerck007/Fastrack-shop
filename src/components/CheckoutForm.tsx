"use client";

import { useState, useTransition } from "react";
import { useMarket } from "@/components/MoneyProvider";
import { marketOffsetMinutes } from "@/lib/timezone";
import AddressForm from "@/components/AddressForm";
import { placeOrder } from "@/lib/actions/orders";
import { useLocale } from "@/components/LocaleProvider";
import { localizedName, localizedField } from "@/lib/i18n/localized";
import { extractTax } from "@/lib/tax";
import { formatDeliveryDate, pricingFor, standardDeliveryDate } from "@/lib/delivery-methods";
import type { Address, CartItemWithVariant, DeliveryType, PaymentMethod } from "@/types/database";
import { useMoney } from "@/components/MoneyProvider";

const DELIVERY_OPTION_DEFS: { value: DeliveryType; labelKey: string; hintKey: string; feeKey: "express" | "standard" }[] = [
  { value: "express", labelKey: "checkout.express", hintKey: "checkout.minutes_15_30", feeKey: "express" },
  { value: "standard", labelKey: "checkout.standard", hintKey: "checkout.minutes_30_60", feeKey: "standard" },
  { value: "scheduled", labelKey: "checkout.scheduled", hintKey: "checkout.choose_datetime", feeKey: "standard" },
];

// Card/Apple Pay are modeled in the schema (see PaymentMethod) but there is
// no payment gateway wired up yet — selecting them would place an order
// marked "authorized" without ever actually charging anyone. Until a real
// gateway (Moyasar/HyperPay/Tap/PayTabs) is integrated, checkout only
// offers Cash on Delivery; placeOrder() also enforces this server-side.
const PAYMENT_OPTIONS: { value: PaymentMethod }[] = [{ value: "cash_on_delivery" }];


export default function CheckoutForm({
  addresses,
  items,
  subtotal,
  blockedByAddress = {},
  methodsByAddress = {},
  taxTotal = 0,
  taxLabel = "VAT",
  groups = [],
  deliveryTaxPercent = 0,
}: {
  addresses: Address[];
  items: CartItemWithVariant[];
  subtotal: number;
  blockedByAddress?: Record<string, string[]>;
  taxTotal?: number;
  taxLabel?: string;
  /** GST inside the delivery fee (India), 0 where it isn't taxed separately. */
  deliveryTaxPercent?: number;
  /** One entry per supplier in the cart; each becomes its own order with its own delivery fee. */
  groups?: { key: string; name: string; subtotal: number }[];
  methodsByAddress?: Record<string, { express: boolean; standard: boolean; standardDays: number }>;
}) {
  const money = useMoney();
  const { t, locale } = useLocale();
  const offsetMin = marketOffsetMinutes(useMarket().countryCode);
  const pricing = pricingFor(useMarket().countryCode);
  const FREE_DELIVERY_THRESHOLD = pricing.freeOver;
  const DELIVERY_OPTIONS = DELIVERY_OPTION_DEFS.map((d) => ({ ...d, fee: pricing[d.feeKey] }));
  // null means "no explicit user selection yet" — fall back to the first
  // address, which also picks up addresses added after this component mounted
  // (the addresses prop refreshes via server-action revalidation).
  const [selectedAddressId, setAddressId] = useState<string | null>(null);
  const addressId =
    selectedAddressId && addresses.some((a) => a.id === selectedAddressId)
      ? selectedAddressId
      : addresses[0]?.id ?? "";
  const blockedItems = blockedByAddress[addressId] ?? [];
  const [chosenDeliveryType, setDeliveryType] = useState<DeliveryType>("standard");
  const [scheduledFor, setScheduledFor] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash_on_delivery");
  const [notes, setNotes] = useState("");
  const [showAddresses, setShowAddresses] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Express only inside the express radius; Standard (and Scheduled) wherever Standard applies.
  const offered = methodsByAddress[addressId] ?? { express: true, standard: true, standardDays: 2 };
  const optionAvailable = (type: DeliveryType) => (type === "express" ? offered.express : offered.standard);
  // If the chosen method isn't offered at the selected address, fall back to one that is.
  const deliveryType: DeliveryType = optionAvailable(chosenDeliveryType)
    ? chosenDeliveryType
    : offered.standard
      ? "standard"
      : offered.express
        ? "express"
        : chosenDeliveryType;
  const standardDate = formatDeliveryDate(standardDeliveryDate(offered.standardDays, new Date(), offsetMin), locale);

  const methodFee = DELIVERY_OPTIONS.find((d) => d.value === deliveryType)!.fee;
  const parcels = (groups.length > 0 ? groups : [{ key: "all", name: "", subtotal }]).map((g) => ({
    ...g,
    fee: g.subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : methodFee,
  }));
  const split = parcels.length > 1;
  const deliveryFee = Math.round(parcels.reduce((sum, g) => sum + g.fee, 0) * 100) / 100;
  const total = Math.round((subtotal + deliveryFee) * 100) / 100;
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  function handlePlaceOrder() {
    setError(null);
    if (!addressId) {
      setError(t("checkout.select_address_error"));
      return;
    }
    if (!offered.express && !offered.standard) {
      setError(t("delivery_info.standard_unavailable"));
      return;
    }
    if (blockedItems.length > 0) {
      setError(t("checkout.cant_deliver_items", { items: blockedItems.join(locale === "ar" ? "، " : ", ") }));
      return;
    }
    startTransition(async () => {
      try {
        const result = await placeOrder({
          addressId,
          deliveryType,
          scheduledFor: deliveryType === "scheduled" ? scheduledFor : undefined,
          paymentMethod,
          notes: notes.trim() || undefined,
        });
        if (result?.error) setError(result.error);
      } catch (err) {
        // Next.js redirect() throws an object with a NEXT_REDIRECT digest — rethrow so navigation still happens.
        const digest = (err as { digest?: string } | null)?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw err;
        setError(err instanceof Error ? err.message : t("checkout.could_not_place_order"));
      }
    });
  }

  const listSep = locale === "ar" ? "، " : ", ";
  const selectedAddress = addresses.find((a) => a.id === addressId) ?? null;
  const freeLeft = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);
  const card = "rounded-3xl bg-white p-4 shadow-sm ring-1 ring-neutral-100";
  const labelText = (label: Address["label"]) =>
    label === "home" ? t("addresses.label_home") : label === "office" ? t("addresses.label_office") : t("addresses.label_other");
  const addressMeta = (addr: Address) =>
    [
      addr.building_number && `${t("addresses.bldg_short")} ${addr.building_number}`,
      addr.unit_number && `${t("addresses.unit_short")} ${addr.unit_number}`,
      addr.landmark,
      addr.district,
      addr.city,
      addr.state,
      addr.state ? addr.postal_code : null,
    ]
      .filter(Boolean)
      .join(", ");

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          {/* delivery address */}
          <section className={card}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-extrabold tracking-tight">{t("checkout_ui.deliver_to")}</h2>
              {addresses.length > 1 && (
                <button type="button" onClick={() => setShowAddresses((v) => !v)} className="text-sm font-bold text-blue-700">
                  {showAddresses ? t("common.cancel") : t("checkout_ui.change")}
                </button>
              )}
            </div>

            {selectedAddress && !showAddresses && (
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-xl">📍</span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="flex items-center gap-2 font-bold text-neutral-900">
                    {labelText(selectedAddress.label)}
                    {selectedAddress.short_address && (
                      <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-600">
                        {selectedAddress.short_address}
                      </span>
                    )}
                  </p>
                  <p className="text-neutral-700">{selectedAddress.address_line}</p>
                  <p className="text-xs text-neutral-500">{addressMeta(selectedAddress)}</p>
                  {selectedAddress.receiver_name && (
                    <p className="mt-1 text-xs font-medium text-neutral-700">
                      {selectedAddress.receiver_name}
                      {selectedAddress.receiver_phone && (
                        <span className="ms-2 font-normal text-neutral-500">📞 {selectedAddress.receiver_phone}</span>
                      )}
                    </p>
                  )}
                  {blockedByAddress[selectedAddress.id] ? (
                    <p className="mt-1 text-xs font-medium text-red-600">
                      {t("checkout.outside_delivery_area", { items: blockedByAddress[selectedAddress.id].join(listSep) })}
                    </p>
                  ) : selectedAddress.lat != null && selectedAddress.lng != null ? (
                    <p className="mt-1 text-xs font-medium text-emerald-600">✓ {t("checkout.map_pinned_deliverable")}</p>
                  ) : null}
                </div>
              </div>
            )}

            {(showAddresses || !selectedAddress) && (
              <div className="flex flex-col gap-2">
                {addresses.map((addr) => (
                  <label
                    key={addr.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 text-sm ${
                      addressId === addr.id ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : "border-neutral-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="address"
                      checked={addressId === addr.id}
                      onChange={() => {
                        setAddressId(addr.id);
                        setShowAddresses(false);
                      }}
                      className="mt-1"
                    />
                    <span className="flex flex-col gap-0.5">
                      <span className="font-bold">{labelText(addr.label)}</span>
                      <span>{addr.address_line}</span>
                      <span className="text-xs text-neutral-500">{addressMeta(addr)}</span>
                      {blockedByAddress[addr.id] && (
                        <span className="text-xs font-medium text-red-600">
                          {t("checkout.outside_delivery_area", { items: blockedByAddress[addr.id].join(listSep) })}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            )}

            <div className="pt-3">
              <AddressForm
                onAdded={(id) => {
                  setAddressId(id);
                  setShowAddresses(false);
                }}
                triggerLabel={addresses.length === 0 ? t("checkout.add_delivery_address") : t("common.add_new_address")}
              />
            </div>
          </section>

          {/* delivery speed */}
          <section className={card}>
            <h2 className="mb-3 text-base font-extrabold tracking-tight">{t("checkout.delivery_time")}</h2>
            <div className="grid grid-cols-3 gap-2">
              {DELIVERY_OPTIONS.map((opt) => {
                const active = deliveryType === opt.value;
                const available = optionAvailable(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={!available}
                    onClick={() => setDeliveryType(opt.value)}
                    className={`flex flex-col items-center gap-0.5 rounded-2xl border p-3 text-center transition ${
                      !available
                        ? "cursor-not-allowed border-neutral-200 bg-neutral-50 opacity-60"
                        : active
                          ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600 active:scale-95"
                          : "border-neutral-200 active:scale-95"
                    }`}
                  >
                    <span className={`text-xl ${available ? "" : "grayscale"}`}>{opt.value === "express" ? "⚡" : opt.value === "standard" ? "📦" : "🗓️"}</span>
                    <span className={`text-sm font-bold ${active ? "text-blue-800" : "text-neutral-900"}`}>{t(opt.labelKey)}</span>
                    <span className="text-[11px] leading-tight text-neutral-500">
                      {!available
                        ? t("delivery_info.not_available_here")
                        : opt.value === "express"
                          ? t("delivery_info.express_eta")
                          : opt.value === "standard"
                            ? t("delivery_info.standard_by", { date: standardDate })
                            : t(opt.hintKey)}
                    </span>
                    {available && (
                      <span className={`mt-1 text-xs font-extrabold ${subtotal >= FREE_DELIVERY_THRESHOLD ? "text-emerald-600" : "text-neutral-800"}`}>
                        {subtotal >= FREE_DELIVERY_THRESHOLD ? t("checkout.free") : money(opt.fee)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {deliveryType === "scheduled" && (
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="mt-3 w-full rounded-2xl border border-neutral-300 px-3 py-2.5 text-sm"
              />
            )}
          </section>

          {/* order items */}
          <section className={card}>
            <h2 className="mb-1 text-base font-extrabold tracking-tight">{t("checkout.items_in_order", { count: itemCount })}</h2>
            <div className="divide-y divide-neutral-100">
              {items.map((item) => {
                const variant = item.product_variants;
                const product = variant.products;
                const name = localizedName(product, locale);
                return (
                  <div key={item.id} className="flex items-center gap-3 py-3">
                    <div className="relative h-16 w-16 shrink-0">
                      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-2xl bg-neutral-100">
                        {product.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.image_url} alt={name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-2xl">📦</span>
                        )}
                      </div>
                      <span className="absolute -end-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-700 px-1.5 text-xs font-extrabold text-white ring-2 ring-white">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-neutral-900">{name}</p>
                      <p className="text-xs text-neutral-500">{localizedField(variant.label, variant.label_ar, locale)}</p>
                    </div>
                    <span className="shrink-0 text-sm font-extrabold">{money(item.quantity * variant.price)}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* payment */}
          <section className={card}>
            <h2 className="mb-3 text-base font-extrabold tracking-tight">{t("checkout.payment")}</h2>
            {PAYMENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPaymentMethod(opt.value)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-start ${
                  paymentMethod === opt.value ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : "border-neutral-200"
                }`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm ring-1 ring-neutral-100">
                  💵
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-neutral-900">{t("checkout_ui.cod_title")}</span>
                  <span className="block text-xs text-neutral-500">{t("checkout_ui.cod_hint")}</span>
                </span>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-700 text-xs text-white">✓</span>
              </button>
            ))}
          </section>

          {/* note for the rider */}
          <section className={card}>
            <h2 className="mb-2 text-base font-extrabold tracking-tight">{t("checkout_ui.note_title")}</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 200))}
              rows={2}
              placeholder={t("checkout_ui.note_placeholder")}
              className="w-full resize-none rounded-2xl border border-neutral-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </section>
        </div>

        {/* summary */}
        <div className="h-fit lg:sticky lg:top-20">
          <div className={card}>
            <h2 className="mb-3 text-base font-extrabold tracking-tight">{t("checkout.order_summary")}</h2>

            {split && (
              <div className="mb-3 rounded-2xl bg-blue-50 px-3 py-2.5 text-xs text-blue-900">
                <p className="font-bold">{t("checkout_ui.split_title", { count: String(parcels.length) })}</p>
                <p className="mt-0.5 text-blue-800/80">{t("checkout_ui.split_hint")}</p>
              </div>
            )}
            <div
              className={`${split ? "hidden " : ""}mb-3 rounded-2xl px-3 py-2.5 text-xs font-bold ${
                freeLeft === 0 ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-800"
              }`}
            >
              {freeLeft === 0 ? (
                t("checkout_ui.free_unlocked")
              ) : (
                <>
                  {t("checkout_ui.add_for_free", { amount: money(freeLeft) })}
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-blue-100">
                    <span
                      className="block h-full rounded-full bg-blue-600"
                      style={{ width: `${Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD) * 100)}%` }}
                    />
                  </span>
                </>
              )}
            </div>

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-500">{t("orders.item_subtotal")}</span>
                <span className="font-medium">{money(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">{t("checkout.delivery_fee")}</span>
                <span className={`font-medium ${deliveryFee === 0 ? "text-emerald-600" : ""}`}>
                  {deliveryFee === 0 ? t("checkout.free") : money(deliveryFee)}
                </span>
              </div>
              {split &&
                parcels.map((g) => (
                  <div key={g.key} className="flex justify-between text-xs text-neutral-400">
                    <span>{g.name ? t("checkout_ui.parcel_label", { shop: g.name }) : `Delivery ${parcels.indexOf(g) + 1}`}</span>
                    <span>{g.fee === 0 ? t("checkout.free") : money(g.fee)}</span>
                  </div>
                ))}
              <div className="flex justify-between border-t border-dashed border-neutral-200 pt-2 text-base font-extrabold">
                <span>{t("checkout.total")}</span>
                <span>{money(total)}</span>
              </div>
              <p className="text-end text-[11px] text-neutral-400">{t("checkout_ui.vat_included", { label: taxLabel, amount: money(Math.round((taxTotal + parcels.reduce((n, g) => n + extractTax(g.fee, deliveryTaxPercent), 0)) * 100) / 100) })}</p>
            </div>

            {error && <p className="mt-3 hidden text-sm text-red-600 lg:block">{error}</p>}

            <button
              onClick={handlePlaceOrder}
              disabled={pending || blockedItems.length > 0}
              className="mt-4 hidden h-12 w-full rounded-full bg-blue-700 font-extrabold text-white shadow-lg shadow-blue-700/25 hover:bg-blue-800 disabled:opacity-50 lg:block"
            >
              {pending ? t("checkout.placing_order") : t("checkout.place_order_with_total", { total: money(total) })}
            </button>
            {blockedItems.length > 0 && (
              <p className="mt-2 text-center text-xs text-red-600">
                {t("checkout.some_items_blocked", { items: blockedItems.join(listSep) })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Keeta-style bottom bar on phones: the total, and a big Place order button. */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 rounded-t-3xl bg-white px-4 pt-3 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] lg:hidden"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {error && <p className="mb-2 text-xs font-medium text-red-600">{error}</p>}
        {blockedItems.length > 0 && !error && (
          <p className="mb-2 text-xs font-medium text-red-600">
            {t("checkout.some_items_blocked", { items: blockedItems.join(listSep) })}
          </p>
        )}
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-neutral-500">{t("checkout.total")}</p>
            <p className="text-xl font-extrabold text-neutral-900">{money(total)}</p>
          </div>
          <button
            onClick={handlePlaceOrder}
            disabled={pending || blockedItems.length > 0}
            className="h-12 shrink-0 rounded-full bg-blue-700 px-8 text-sm font-extrabold text-white shadow-lg shadow-blue-700/25 transition hover:bg-blue-800 active:scale-95 disabled:opacity-50"
          >
            {pending ? t("checkout.placing_order") : t("checkout.place_order")}
          </button>
        </div>
      </div>
    </>
  );
}

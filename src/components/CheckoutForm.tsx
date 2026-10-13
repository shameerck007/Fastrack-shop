"use client";


import { errorText, unwrapAction } from "@/lib/errors";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { useMarket, usePricing } from "@/components/MoneyProvider";
import { marketOffsetMinutes } from "@/lib/timezone";
import AddressForm from "@/components/AddressForm";
import { placeOrder } from "@/lib/actions/orders";
import { quoteOffer } from "@/lib/actions/offers";
import type { OfferQuote } from "@/lib/offers";
import { useLocale } from "@/components/LocaleProvider";
import { localizedName, localizedField } from "@/lib/i18n/localized";
import { extractTax } from "@/lib/tax";
import { useDeliveryLocation } from "@/components/delivery-location-context";
import { marketUi } from "@/lib/market-ui";
import { formatEta } from "@/lib/eta";
import { formatDeliveryDate, splitDeliveryFee, standardDeliveryDate } from "@/lib/delivery-methods";
import type { Address, CartItemWithVariant, DeliveryType } from "@/types/database";
import { useMoney } from "@/components/MoneyProvider";
import PaymentOptions, { type PayChoice } from "@/components/PaymentOptions";
import { hasErrors, validateCard, cvcProblem, type CardInput } from "@/lib/card";
import { applePayAvailable, payWithApplePay, submitCard, type PaymentStart } from "@/lib/moyasar-browser";
import { noteProviderPayment, payWithSavedCard, startOnlinePayment, type SavedCard } from "@/lib/actions/payments";
import MapPinIcon from "@/components/MapPinIcon";

const DELIVERY_OPTION_DEFS: { value: DeliveryType; labelKey: string; hintKey: string; feeKey: "express" | "standard" }[] = [
  { value: "express", labelKey: "checkout.express", hintKey: "checkout.minutes_15_30", feeKey: "express" },
  { value: "standard", labelKey: "checkout.standard", hintKey: "checkout.minutes_30_60", feeKey: "standard" },
  { value: "scheduled", labelKey: "checkout.scheduled", hintKey: "checkout.choose_datetime", feeKey: "standard" },
];

// Cash on Delivery places the order straight away. Card, saved card and Apple Pay go through Moyasar: the money is confirmed first and
// only then are the orders created (see src/lib/payment-finalize.ts). Online options show only where a provider is set up.


export default function CheckoutForm({
  addresses,
  items,
  subtotal,
  blockedByAddress = {},
  methodsByAddress = {},
  shipmentMethods = {},
  taxTotal = 0,
  taxLabel = "VAT",
  groups = [],
  deliveryTaxPercent = 0,
  onlineEnabled = false,
  savedCards = [],
  payNotice = null,
}: {
  addresses: Address[];
  items: CartItemWithVariant[];
  subtotal: number;
  /** Card, saved card and Apple Pay are offered (a payment provider is set up for this market). */
  onlineEnabled?: boolean;
  savedCards?: SavedCard[];
  /** A message from the payment return page (declined, refunded, still confirming). */
  payNotice?: { kind: "error" | "info"; text: string } | null;
  blockedByAddress?: Record<string, string[]>;
  taxTotal?: number;
  taxLabel?: string;
  /** GST inside the delivery fee (India), 0 where it isn't taxed separately. */
  deliveryTaxPercent?: number;
  /** One entry per supplier in the cart; each becomes its own order with its own delivery fee. */
  groups?: { key: string; name: string; subtotal: number; storeId?: string | null }[];
  methodsByAddress?: Record<string, { express: boolean; standard: boolean; standardDays: number }>;
  /** Per address, then per shipment key: which methods apply to that shipment. */
  shipmentMethods?: Record<string, Record<string, { express: boolean; standard: boolean; standardDays: number }>>;
}) {
  const money = useMoney();
  const { t, locale } = useLocale();
  const offsetMin = marketOffsetMinutes(useMarket().countryCode);
  const pricing = usePricing();
  const FREE_DELIVERY_THRESHOLD = pricing.freeOver;
  const DELIVERY_OPTIONS = DELIVERY_OPTION_DEFS.map((d) => ({ ...d, fee: pricing[d.feeKey] }));
  // null means "no explicit user selection yet" — fall back to the first
  // address that can take everything in the cart (else the first), which also picks up addresses added after this component mounted
  // (the addresses prop refreshes via server-action revalidation).
  const [selectedAddressId, setAddressId] = useState<string | null>(null);
  const addressId =
    selectedAddressId && addresses.some((a) => a.id === selectedAddressId)
      ? selectedAddressId
      : (addresses.find((a) => (blockedByAddress[a.id] ?? []).length === 0) ?? addresses[0])?.id ?? "";
  const blockedItems = blockedByAddress[addressId] ?? [];
  // The shopper does not pick Express or Standard: the system does, from where the order is going (like Instamart or Keeta).
  // The only choice left is to schedule the order for later.
  const [scheduleLater, setScheduleLater] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  // Start on the shopper's default saved card, if they have one.
  const [payChoice, setPayChoice] = useState<PayChoice>(() => {
    const d = onlineEnabled ? (savedCards.find((c) => c.isDefault) ?? savedCards[0]) : undefined;
    return d ? `saved:${d.id}` : "cod";
  });
  const [cardDraft, setCardDraft] = useState<CardInput>({ name: "", number: "", expiry: "", cvc: "" });
  const [saveCard, setSaveCard] = useState(true);
  const [savedCvc, setSavedCvc] = useState("");
  const [savedCvcError, setSavedCvcError] = useState<string | null>(null);
  const appleAvailable = useSyncExternalStore(() => () => {}, applePayAvailable, () => false);
  const [notes, setNotes] = useState("");
  const [showAddresses, setShowAddresses] = useState(false);
  const [error, setError] = useState<string | null>(payNotice?.kind === "error" ? payNotice.text : null);
  const [pending, startTransition] = useTransition();
  // Offers: a coupon the shopper types, or an automatic offer the shop applies by itself. The database decides what it is worth.
  const [quote, setQuote] = useState<OfferQuote | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  useEffect(() => {
    let live = true;
    unwrapAction(quoteOffer)(null)
      .then((q) => live && q.ok && setQuote(q))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const reasonText = (q: OfferQuote) =>
    q.reason === "min_order" && q.minOrder != null
      ? t("offers_ui.min_order", { amount: money(q.minOrder) })
      : t(`offers_ui.reason_${["expired", "used_up", "used_by_you", "first_order_only", "no_eligible"].includes(q.reason ?? "") ? q.reason : "invalid"}`);
  function removeCoupon() {
    // Back to whatever the shop applies by itself, if anything.
    setQuote(null);
    unwrapAction(quoteOffer)(null)
      .then((q) => q.ok && setQuote(q))
      .catch(() => {});
  }
  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    setCheckingCoupon(true);
    setCouponError(null);
    try {
      const q = await unwrapAction(quoteOffer)(code);
      if (q.ok) {
        setQuote(q);
        setCouponInput("");
      } else setCouponError(reasonText(q));
    } catch {
      setCouponError(t("offers_ui.reason_invalid"));
    } finally {
      setCheckingCoupon(false);
    }
  }

  const offered = methodsByAddress[addressId] ?? { express: true, standard: true, standardDays: 2 };
  const { etaAt } = useDeliveryLocation();
  const chosenAddress = addresses.find((a) => a.id === addressId);
  const showTimes = marketUi(useMarket().countryCode).deliveryBadges;
  // Each shipment (one per supplier) gets its own method and time from where it is going: Express where its shop's
  // Express area reaches the address, otherwise Standard. "Later" is the only thing the shopper picks.
  const parcels = (groups.length > 0 ? groups : [{ key: "all", name: "", subtotal, storeId: undefined as string | null | undefined }]).map((g) => {
    const m = shipmentMethods[addressId]?.[g.key] ?? offered;
    const type: DeliveryType = scheduleLater && m.standard ? "scheduled" : m.express ? "express" : m.standard ? "standard" : "express";
    const range =
      showTimes && type === "express" && chosenAddress?.lat != null && chosenAddress?.lng != null
        ? etaAt(chosenAddress.lat, chosenAddress.lng, g.storeId !== undefined ? [g.storeId] : items.map((i) => i.product_variants.products.store_id ?? null))
        : null;
    return {
      ...g,
      type,
      available: m.express || m.standard,
      etaText: range ? formatEta(range) : null,
      date: formatDeliveryDate(standardDeliveryDate(m.standardDays, new Date(), offsetMin), locale),
      fee: 0,
    };
  });
  const deliveryType: DeliveryType = parcels[0]?.type ?? "express";
  const anyStandardAvailable = parcels.every((p) => (shipmentMethods[addressId]?.[p.key] ?? offered).standard);
  const allDeliverable = parcels.every((p) => p.available);
  const split = parcels.length > 1;
  // One delivery charge for the whole cart, however many shops it splits into.
  const feeSplit = splitDeliveryFee(parcels.map((p) => ({ key: p.key, subtotal: p.subtotal, method: p.type })), pricing, !!quote?.freeDelivery);
  const deliveryFee = feeSplit.total;
  for (const p of parcels) p.fee = feeSplit.byKey.get(p.key) ?? 0;
  const discount = Math.min(subtotal, quote?.discount ?? 0);
  const total = Math.round((subtotal - discount + deliveryFee) * 100) / 100;
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  function handlePlaceOrder() {
    setError(null);
    if (!addressId) {
      setError(t("checkout.select_address_error"));
      return;
    }
    if (!allDeliverable) {
      setError(t("delivery_info.standard_unavailable"));
      return;
    }
    if (blockedItems.length > 0) {
      setError(t("checkout.cant_deliver_items", { items: blockedItems.join(locale === "ar" ? "، " : ", ") }));
      return;
    }
    const shared = {
      addressId,
      // Express/Standard are decided per shipment on the server; only "scheduled" is the shopper's choice.
      deliveryType: scheduleLater ? ("scheduled" as const) : deliveryType,
      scheduledFor: scheduleLater ? scheduledFor : undefined,
      notes: notes.trim() || undefined,
      offerCode: quote?.code ?? null,
    };

    // Online payment: check the card here first, so a typing mistake is explained before anything is sent.
    if (payChoice === "card") {
      const problems = validateCard(cardDraft);
      if (hasErrors(problems)) {
        setError(Object.values(problems)[0] ?? "Check your card details.");
        return;
      }
    }
    if (payChoice.startsWith("saved:")) {
      const saved = savedCards.find((c) => `saved:${c.id}` === payChoice);
      const problem = cvcProblem(savedCvc, saved?.brand === "amex" ? "amex" : "visa");
      setSavedCvcError(problem);
      if (problem) return;
    }

    startTransition(async () => {
      try {
        if (payChoice === "cod") {
          const result = await unwrapAction(placeOrder)({ ...shared, paymentMethod: "cash_on_delivery" });
          if (result?.error) setError(result.error);
          return;
        }
        if (payChoice === "card") {
          const start = (await unwrapAction(startOnlinePayment)(shared, saveCard)) as PaymentStart;
          const { paymentId, next } = await submitCard(start, cardDraft, saveCard);
          await unwrapAction(noteProviderPayment)(start.sessionId, paymentId).catch(() => {});
          window.location.href = next;
          return;
        }
        if (payChoice === "apple") {
          const { next } = await payWithApplePay({
            displayTotal: total,
            saveCard: false,
            start: async () => (await unwrapAction(startOnlinePayment)(shared, false)) as PaymentStart,
          });
          window.location.href = next;
          return;
        }
        // A saved card: charged by our server with the code just typed, then the bank confirms.
        const cardId = payChoice.slice("saved:".length);
        const out = (await unwrapAction(payWithSavedCard)(shared, cardId, savedCvc)) as { redirectUrl: string };
        window.location.href = out.redirectUrl;
      } catch (err) {
        // Next.js redirect() throws an object with a NEXT_REDIRECT digest — rethrow so navigation still happens.
        const digest = (err as { digest?: string } | null)?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw err;
        if (err instanceof Error && err.message === "cancelled") return;
        setError(errorText(err, t("checkout.could_not_place_order")));
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
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 max-md:pb-44 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-4">
          {/* delivery address */}
          <section className={card}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-extrabold tracking-tight">{t("checkout_ui.deliver_to")}</h2>
              {addresses.length > 1 && (
                <button type="button" onClick={() => setShowAddresses((v) => !v)} className="text-sm font-bold text-brand-700">
                  {showAddresses ? t("common.cancel") : t("checkout_ui.change")}
                </button>
              )}
            </div>

            {selectedAddress && !showAddresses && (
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-xl"><MapPinIcon /></span>
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
                      addressId === addr.id ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-neutral-200"
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

          {/* delivery: chosen by the system per shipment from the address, not by the shopper */}
          <section className={card}>
            <h2 className="mb-1 text-base font-extrabold tracking-tight">{t("checkout.delivery_time")}</h2>
            <p className="mb-3 text-xs text-neutral-500">{t("checkout.auto_delivery_hint")}</p>
            {!allDeliverable ? (
              <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm font-semibold text-brand-900">{t("delivery_info.not_available_here")}</div>
            ) : (
              <div className="flex flex-col gap-2">
                {parcels.map((p, idx) => (
                  <div key={p.key} className="flex items-center gap-3 rounded-2xl border border-brand-600 bg-brand-50 p-3.5 ring-1 ring-brand-600">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-xl shadow-sm">
                      {p.type === "scheduled" ? "🗓️" : "🕒"}
                    </span>
                    <div className="min-w-0 flex-1">
                      {split && (
                        <p className="truncate text-[11px] font-bold uppercase tracking-wide text-brand-800/70">
                          {p.name ? p.name : "Delivery " + (idx + 1)}
                        </p>
                      )}
                      <p className="text-sm font-extrabold text-brand-900">
                        {p.type === "express"
                          ? t("checkout.arrives_in", { eta: p.etaText ?? t("delivery_info.express_eta") })
                          : p.type === "standard"
                            ? t("checkout.arrives_by", { date: p.date })
                            : t("checkout.scheduled")}
                      </p>
                    </div>
                    {!split && (
                      <span className={`shrink-0 text-sm font-extrabold ${deliveryFee === 0 ? "text-emerald-600" : "text-neutral-900"}`}>
                        {deliveryFee === 0 ? t("checkout.free") : money(deliveryFee)}
                      </span>
                    )}
                  </div>
                ))}
                {split && (
                  <div className="flex items-center justify-between rounded-2xl bg-neutral-50 px-3.5 py-2.5 text-sm">
                    <span className="font-semibold text-neutral-700">{t("checkout_ui.one_delivery_fee")}</span>
                    <span className={`font-extrabold ${deliveryFee === 0 ? "text-emerald-600" : "text-neutral-900"}`}>
                      {deliveryFee === 0 ? t("checkout.free") : money(deliveryFee)}
                    </span>
                  </div>
                )}
              </div>
            )}
            {anyStandardAvailable && (
              <button type="button" onClick={() => setScheduleLater((v) => !v)} className="mt-3 text-sm font-bold text-brand-700 hover:underline">
                {scheduleLater ? t("checkout.deliver_now") : t("checkout.schedule_later")}
              </button>
            )}
            {scheduleLater && (
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="mt-3 w-full rounded-2xl border border-neutral-300 px-3 py-2.5 text-base"
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
                      <span className="absolute -end-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-700 px-1.5 text-xs font-extrabold text-white ring-2 ring-white">
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
            {payNotice?.kind === "info" && <p className="mb-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">{payNotice.text}</p>}
            <PaymentOptions
              codTitle={t("checkout_ui.cod_title")}
              codHint={t("checkout_ui.cod_hint")}
              onlineEnabled={onlineEnabled}
              appleAvailable={appleAvailable}
              savedCards={savedCards}
              value={payChoice}
              onChange={(v) => {
                setPayChoice(v);
                setError(null);
              }}
              card={cardDraft}
              onCard={setCardDraft}
              errors={validateCard(cardDraft)}
              saveCard={saveCard}
              onSaveCard={setSaveCard}
              savedCvc={savedCvc}
              onSavedCvc={(v) => {
                setSavedCvc(v);
                setSavedCvcError(null);
              }}
              savedCvcError={savedCvcError}
            />
          </section>

          {/* note for the rider */}
          <section className={card}>
            <h2 className="mb-2 text-base font-extrabold tracking-tight">{t("checkout_ui.note_title")}</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 200))}
              rows={2}
              placeholder={t("checkout_ui.note_placeholder")}
              className="w-full resize-none rounded-2xl border border-neutral-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </section>
        </div>

        {/* summary */}
        <div className="h-fit lg:sticky lg:top-20">
          <div className={card}>
            <h2 className="mb-3 text-base font-extrabold tracking-tight">{t("checkout.order_summary")}</h2>

            {split && (
              <div className="mb-3 rounded-2xl bg-brand-50 px-3 py-2.5 text-xs text-brand-900">
                <p className="font-bold">{t("checkout_ui.split_title", { count: String(parcels.length) })}</p>
                <p className="mt-0.5 text-brand-800/80">{t("checkout_ui.split_hint")}</p>
              </div>
            )}
            {pricing.freeEnabled && (
            <div
              className={`mb-3 rounded-2xl px-3 py-2.5 text-xs font-bold ${
                freeLeft === 0 ? "bg-emerald-50 text-emerald-700" : "bg-brand-50 text-brand-800"
              }`}
            >
              {freeLeft === 0 ? (
                t("checkout_ui.free_unlocked")
              ) : (
                <>
                  {t("checkout_ui.add_for_free", { amount: money(freeLeft) })}
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-brand-100">
                    <span
                      className="block h-full rounded-full bg-brand-600"
                      style={{ width: `${Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD) * 100)}%` }}
                    />
                  </span>
                </>
              )}
            </div>
            )}

            <div className="mb-3">
              {quote?.ok ? (
                <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-800">
                  <span aria-hidden>🏷️</span>
                  <span className="min-w-0 flex-1 truncate">
                    {quote.parts.map((p) => (
                      <span key={p.offerId} className="block truncate">
                        {t("offers_ui.applied", { name: (locale === "ar" && p.nameAr) || p.name || p.code || "" })}
                        {p.freeDelivery && <span className="block font-medium text-emerald-700/80">{t("offers_ui.free_delivery")}</span>}
                      </span>
                    ))}
                  </span>
                  {quote.code && (
                    <button type="button" onClick={removeCoupon} className="shrink-0 font-bold text-emerald-900 underline">
                      {t("offers_ui.remove")}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      value={couponInput}
                      onChange={(e) => {
                        setCouponInput(e.target.value.toUpperCase());
                        setCouponError(null);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                      placeholder={t("offers_ui.placeholder")}
                      aria-label={t("offers_ui.title")}
                      className="h-10 min-w-0 flex-1 rounded-full border border-neutral-300 px-4 text-sm uppercase placeholder:normal-case focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    />
                    <button type="button" onClick={applyCoupon} disabled={checkingCoupon || !couponInput.trim()} className="h-10 shrink-0 rounded-full border border-brand-700 px-4 text-sm font-bold text-brand-700 hover:bg-brand-50 disabled:opacity-50">
                      {t("offers_ui.apply")}
                    </button>
                  </div>
                  {couponError && <p className="mt-1.5 ps-2 text-xs font-medium text-red-600">{couponError}</p>}
                </>
              )}
            </div>

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-500">{t("orders.item_subtotal")}</span>
                <span className="font-medium">{money(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">{t("offers_ui.discount")}</span>
                  <span className="font-medium text-emerald-600">−{money(discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-neutral-500">{t("checkout.delivery_fee")}</span>
                <span className={`font-medium ${deliveryFee === 0 ? "text-emerald-600" : ""}`}>
                  {deliveryFee === 0 ? t("checkout.free") : money(deliveryFee)}
                </span>
              </div>
              <div className="flex justify-between border-t border-dashed border-neutral-200 pt-2 text-base font-extrabold">
                <span>{t("checkout.total")}</span>
                <span>{money(total)}</span>
              </div>
              <p className="text-end text-[11px] text-neutral-500">{t("checkout_ui.vat_included", { label: taxLabel, amount: money(Math.round(((subtotal > 0 ? taxTotal * (1 - discount / subtotal) : taxTotal) + parcels.reduce((n, g) => n + extractTax(g.fee, deliveryTaxPercent), 0)) * 100) / 100) })}</p>
            </div>

            {error && <p className="mt-3 hidden text-sm text-red-600 lg:block">{error}</p>}

            <button
              onClick={handlePlaceOrder}
              disabled={pending || blockedItems.length > 0}
              className="mt-4 hidden h-12 w-full rounded-full bg-brand-700 font-extrabold text-white shadow-lg shadow-brand-700/25 hover:bg-brand-800 disabled:opacity-50 lg:block"
            >
              {pending ? (payChoice === "cod" ? t("checkout.placing_order") : "Processing payment…") : payChoice === "cod" ? t("checkout.place_order_with_total", { total: money(total) }) : `Pay ${money(total)}`}
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
            className="h-12 shrink-0 rounded-full bg-brand-700 px-8 text-sm font-extrabold text-white shadow-lg shadow-brand-700/25 transition hover:bg-brand-800 active:scale-95 disabled:opacity-50"
          >
            {pending ? (payChoice === "cod" ? t("checkout.placing_order") : "Processing payment…") : payChoice === "cod" ? t("checkout.place_order") : "Pay now"}
          </button>
        </div>
      </div>
    </>
  );
}

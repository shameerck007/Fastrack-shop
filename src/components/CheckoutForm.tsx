"use client";

import { useState, useTransition } from "react";
import { addAddress } from "@/lib/actions/addresses";
import { placeOrder } from "@/lib/actions/orders";
import { formatSAR } from "@/lib/utils";
import type { Address, DeliveryType, PaymentMethod } from "@/types/database";

const DELIVERY_OPTIONS: { value: DeliveryType; label: string; hint: string; fee: number }[] = [
  { value: "express", label: "Express", hint: "15–30 minutes", fee: 12 },
  { value: "standard", label: "Standard", hint: "30–60 minutes", fee: 7 },
  { value: "scheduled", label: "Scheduled", hint: "Choose date/time", fee: 7 },
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
}: {
  addresses: Address[];
  subtotal: number;
}) {
  const [addressId, setAddressId] = useState(addresses[0]?.id ?? "");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("standard");
  const [scheduledFor, setScheduledFor] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash_on_delivery");
  const [showAddressForm, setShowAddressForm] = useState(addresses.length === 0);
  const [newAddressLine, setNewAddressLine] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const deliveryFee =
    subtotal >= 50 ? 0 : DELIVERY_OPTIONS.find((d) => d.value === deliveryType)!.fee;
  const vat = Math.round(subtotal * 0.15 * 100) / 100;
  const total = Math.round((subtotal + deliveryFee + vat) * 100) / 100;

  function handleAddAddress() {
    if (!newAddressLine.trim()) return;
    startTransition(async () => {
      await addAddress({ label: "home", addressLine: newAddressLine.trim() });
      setShowAddressForm(false);
      setNewAddressLine("");
    });
  }

  function handlePlaceOrder() {
    setError(null);
    if (!addressId) {
      setError("Please select or add a delivery address.");
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
        setError(err instanceof Error ? err.message : "Could not place order.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 font-medium">Delivery address</h2>
        <div className="flex flex-col gap-2">
          {addresses.map((addr) => (
            <label
              key={addr.id}
              className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${
                addressId === addr.id ? "border-emerald-600 bg-emerald-50" : "border-neutral-200"
              }`}
            >
              <input
                type="radio"
                name="address"
                checked={addressId === addr.id}
                onChange={() => setAddressId(addr.id)}
              />
              <span>
                <span className="font-medium capitalize">{addr.label}</span> — {addr.address_line}
              </span>
            </label>
          ))}

          {showAddressForm ? (
            <div className="flex gap-2">
              <input
                value={newAddressLine}
                onChange={(e) => setNewAddressLine(e.target.value)}
                placeholder="Building, street, district"
                className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
              <button
                onClick={handleAddAddress}
                disabled={pending}
                className="rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white"
              >
                Save
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddressForm(true)}
              className="text-left text-sm text-emerald-600 hover:underline"
            >
              + Add new address
            </button>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Delivery time</h2>
        <div className="flex flex-col gap-2">
          {DELIVERY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 text-sm ${
                deliveryType === opt.value ? "border-emerald-600 bg-emerald-50" : "border-neutral-200"
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
                  <span className="font-medium">{opt.label}</span>{" "}
                  <span className="text-neutral-500">— {opt.hint}</span>
                </span>
              </span>
              <span>{subtotal >= 50 ? "Free" : formatSAR(opt.fee)}</span>
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
        <h2 className="mb-2 font-medium">Payment</h2>
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${
                paymentMethod === opt.value ? "border-emerald-600 bg-emerald-50" : "border-neutral-200"
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
          <span className="text-neutral-500">Subtotal</span>
          <span>{formatSAR(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Delivery fee</span>
          <span>{deliveryFee === 0 ? "Free" : formatSAR(deliveryFee)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">VAT (15%)</span>
          <span>{formatSAR(vat)}</span>
        </div>
        <div className="flex justify-between border-t border-neutral-200 pt-1 font-semibold">
          <span>Total</span>
          <span>{formatSAR(total)}</span>
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={handlePlaceOrder}
        disabled={pending}
        className="rounded-full bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Placing order..." : `Place Order — ${formatSAR(total)}`}
      </button>
    </div>
  );
}

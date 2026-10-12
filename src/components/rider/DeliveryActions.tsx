"use client";


import { errorText, unwrapAction } from "@/lib/errors";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markPickedUp, completeDelivery } from "@/lib/actions/rider";
import { useLocale } from "@/components/LocaleProvider";
import BarcodeScanner, { type ScanResult } from "@/components/BarcodeScanner";
import { parseDeliveryQr, sameOrder } from "@/lib/scan";
import type { OrderStatus } from "@/types/database";

export default function DeliveryActions({ orderId, orderNumber, status, requirePickupScan = false }: { orderId: string; orderNumber: string; status: OrderStatus; requirePickupScan?: boolean }) {
  const { t } = useLocale();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [pickupCode, setPickupCode] = useState("");
  const [scanning, setScanning] = useState<null | "pickup" | "delivery">(null);

  function handlePickedUp() {
    startTransition(async () => {
      await unwrapAction(markPickedUp)(orderId);
      router.refresh();
    });
  }

  // The parcel label's QR holds the order number: it must be this order's.
  function handlePickupCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await unwrapAction(markPickedUp)(orderId, undefined, pickupCode);
        router.refresh();
      } catch (err) {
        setError(errorText(err, "Could not confirm the pickup."));
      }
    });
  }

  async function onPickupScan(code: string): Promise<ScanResult> {
    if (!sameOrder(code, orderNumber)) return { ok: false, message: `That label is for a different order. This one is #${orderNumber}.` };
    try {
      await unwrapAction(markPickedUp)(orderId, code);
      router.refresh();
      return { ok: true, message: "Parcel confirmed.", done: true };
    } catch (err) {
      return { ok: false, message: errorText(err, "Could not confirm the pickup.") };
    }
  }

  // The customer's QR holds the order number and their 4-digit code, so scanning it is the same as typing the code.
  async function onDeliveryScan(code: string): Promise<ScanResult> {
    const parsed = parseDeliveryQr(code);
    if (!parsed) return { ok: false, message: "That is not a FasTrack delivery code. Ask the customer to show the QR on their order page." };
    if (!sameOrder(parsed.orderNumber, orderNumber)) return { ok: false, message: `That code is for order #${parsed.orderNumber}, not #${orderNumber}.` };
    try {
      await unwrapAction(completeDelivery)(orderId, parsed.otp);
      router.refresh();
      return { ok: true, message: "Delivered.", done: true };
    } catch (err) {
      return { ok: false, message: errorText(err, t("rider.could_not_complete")) };
    }
  }

  function handleComplete(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await unwrapAction(completeDelivery)(orderId, otp);
        router.refresh();
      } catch (err) {
        setError(errorText(err, t("rider.could_not_complete")));
      }
    });
  }

  if (status === "delivered") {
    return <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">{t("rider.delivered_check")}</p>;
  }

  if (status === "rider_assigned" || status === "ready_for_pickup") {
    return (
      <>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setScanning("pickup")}
            className="h-12 w-full rounded-full bg-blue-700 text-base font-extrabold text-white shadow-lg shadow-blue-700/25 transition active:scale-[0.98] hover:bg-blue-800"
          >
            📷 Scan parcel label
          </button>
          <form onSubmit={handlePickupCode} className="flex gap-2">
            <input
              value={pickupCode}
              onChange={(e) => setPickupCode(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              maxLength={4}
              placeholder="Pickup code"
              aria-label="Pickup code from the store"
              className="min-w-0 flex-1 rounded-2xl border border-neutral-300 px-3 py-2 text-center text-lg font-bold tracking-[0.4em] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <button type="submit" disabled={pending || pickupCode.length !== 4} className="rounded-full bg-neutral-900 px-5 text-sm font-bold text-white disabled:opacity-40">
              Confirm
            </button>
          </form>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!requirePickupScan && (
            <button
              onClick={handlePickedUp}
              disabled={pending}
              className="h-11 w-full rounded-full border border-blue-300 text-sm font-bold text-blue-800 transition active:scale-[0.98] hover:bg-blue-50 disabled:opacity-50"
            >
              {t("rider.mark_picked_up")}
            </button>
          )}
        </div>
        {scanning === "pickup" && <BarcodeScanner title="Scan the parcel label" hint={`Point the camera at the QR on the label for order #${orderNumber}.`} onScan={onPickupScan} onClose={() => setScanning(null)} />}
      </>
    );
  }

  if (status === "out_for_delivery") {
    return (
      <>
      <form onSubmit={handleComplete} className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setScanning("delivery")}
          className="h-12 rounded-full bg-blue-700 text-base font-extrabold text-white shadow-lg shadow-blue-700/25 transition active:scale-[0.98] hover:bg-blue-800"
        >
          📷 Scan customer QR
        </button>
        <label className="text-center text-sm font-medium text-neutral-500">or {t("rider.enter_otp_label")}</label>
        <input
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          maxLength={4}
          placeholder={t("rider.otp_placeholder")}
          className="rounded-2xl border border-neutral-300 px-3 py-2.5 text-center text-xl font-bold tracking-[0.5em] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={pending || otp.length !== 4}
          className="h-12 rounded-full bg-blue-700 text-base font-extrabold text-white shadow-lg shadow-blue-700/25 transition active:scale-[0.98] hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? t("rider.verifying") : t("rider.complete_delivery")}
        </button>
      </form>
      {scanning === "delivery" && <BarcodeScanner title="Scan the customer's QR" hint="The customer shows the QR code on their order page." onScan={onDeliveryScan} onClose={() => setScanning(null)} />}
      </>
    );
  }

  return <p className="text-sm text-neutral-500">{t("rider.waiting_for_store")}</p>;
}

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

  const card = "rounded-3xl border border-blue-200 bg-white p-4 shadow-sm";
  const primary = "inline-flex h-10 items-center justify-center gap-2 rounded-full bg-blue-700 px-5 text-sm font-bold text-white transition active:scale-[0.98] hover:bg-blue-800 disabled:opacity-50";
  const secondary = "inline-flex h-10 items-center justify-center rounded-full border border-neutral-300 px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50";
  const codeInput = "h-10 w-32 rounded-xl border border-neutral-300 px-3 text-center text-base font-bold tracking-[0.35em] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";

  if (status === "delivered") {
    return <p className="rounded-2xl bg-blue-50 p-3 text-sm font-medium text-blue-700">{t("rider.delivered_check")}</p>;
  }

  if (status === "rider_assigned" || status === "ready_for_pickup") {
    return (
      <>
        <div className={card}>
          <p className="text-sm font-bold text-neutral-900">Confirm pickup</p>
          <p className="mb-3 text-xs text-neutral-500">Scan the label on the parcel, or enter the 4-digit code the store shows.</p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setScanning("pickup")} className={primary}>
              📷 Scan label
            </button>
            <span className="text-xs text-neutral-400">or</span>
            <form onSubmit={handlePickupCode} className="flex items-center gap-2">
              <input
                value={pickupCode}
                onChange={(e) => setPickupCode(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                maxLength={4}
                placeholder="Code"
                aria-label="Pickup code from the store"
                className={codeInput}
              />
              <button type="submit" disabled={pending || pickupCode.length !== 4} className={secondary}>
                Confirm
              </button>
            </form>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          {!requirePickupScan && (
            <button onClick={handlePickedUp} disabled={pending} className="mt-3 text-xs font-semibold text-blue-700 underline-offset-2 hover:underline disabled:opacity-50">
              {t("rider.mark_picked_up")} without scanning
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
        <div className={card}>
          <p className="text-sm font-bold text-neutral-900">Complete delivery</p>
          <p className="mb-3 text-xs text-neutral-500">Scan the customer&apos;s QR, or enter the 4-digit code they give you.</p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setScanning("delivery")} className={primary}>
              📷 Scan customer QR
            </button>
            <span className="text-xs text-neutral-400">or</span>
            <form onSubmit={handleComplete} className="flex items-center gap-2">
              <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={4} placeholder="OTP" aria-label={t("rider.enter_otp_label")} className={codeInput} />
              <button type="submit" disabled={pending || otp.length !== 4} className={secondary}>
                {pending ? t("rider.verifying") : t("rider.complete_delivery")}
              </button>
            </form>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
        {scanning === "delivery" && <BarcodeScanner title="Scan the customer's QR" hint="The customer shows the QR code on their order page." onScan={onDeliveryScan} onClose={() => setScanning(null)} />}
      </>
    );
  }

  return <p className="rounded-2xl bg-neutral-50 p-3 text-sm text-neutral-500">{t("rider.waiting_for_store")}</p>;
}

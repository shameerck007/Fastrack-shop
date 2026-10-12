"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { deliveryQrPayload } from "@/lib/scan";

/** The customer's handover QR. The rider scans it instead of typing the 4-digit code. */
export default function DeliveryQr({ orderNumber, otp }: { orderNumber: string; otp: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(deliveryQrPayload(orderNumber, otp), { margin: 1, width: 240, color: { dark: "#0f172a", light: "#ffffff" } })
      .then((url) => !cancelled && setSrc(url))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [orderNumber, otp]);
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Delivery QR code" width={160} height={160} className="mx-auto mt-3 rounded-xl border border-blue-200 bg-white p-1.5" />;
}

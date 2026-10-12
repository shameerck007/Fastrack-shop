"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BarcodeScanner, { type ScanResult } from "@/components/BarcodeScanner";
import { secondaryButton } from "@/components/ui/Form";
import { findOrderByNumber } from "@/lib/actions/admin-scan";
import { errorText, unwrapAction } from "@/lib/errors";

/** Admin: scan a parcel label (or type an order number) to open that order. */
export default function OrderScanButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function onScan(code: string): Promise<ScanResult> {
    try {
      const found = await unwrapAction(findOrderByNumber)(code);
      if (!found) return { ok: false, message: `No order matches “${code}” in this market.` };
      router.push(`/admin/orders/${found.id}`);
      return { ok: true, message: `Opening #${found.orderNumber}`, done: true };
    } catch (e) {
      return { ok: false, message: errorText(e, "Could not look that order up.") };
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={secondaryButton}>
        📷 Scan order
      </button>
      {open && <BarcodeScanner title="Find an order" hint="Scan the QR on a parcel label, or type the order number." onScan={onScan} onClose={() => setOpen(false)} />}
    </>
  );
}

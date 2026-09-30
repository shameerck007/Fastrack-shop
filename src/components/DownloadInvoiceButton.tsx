"use client";

import { useState } from "react";
import { useLocale } from "@/components/LocaleProvider";

// Fetches the PDF and saves it directly instead of navigating to the
// endpoint, so no new tab/viewer pops up over the order page.
export default function DownloadInvoiceButton({
  orderId,
  orderNumber,
  variant = "button",
}: {
  orderId: string;
  orderNumber?: string;
  // "link" is the compact inline style used next to "View order details" on
  // the orders list and order detail pages (Amazon's own order cards put
  // Invoice as a plain text link there, not a standalone button) — "button"
  // is the original pill, still used on the admin order detail page.
  variant?: "button" | "link";
}) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/invoice`);
      if (!res.ok) throw new Error(t("orders.could_not_download_invoice"));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${orderNumber ?? orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("orders.could_not_download_invoice"));
    } finally {
      setBusy(false);
    }
  }

  if (variant === "link") {
    return (
      <span className="inline-flex flex-col items-end gap-0.5">
        <button
          type="button"
          onClick={download}
          disabled={busy}
          className="text-sm font-medium text-blue-700 hover:underline disabled:opacity-60"
        >
          {busy ? t("orders.preparing_invoice") : t("orders.invoice")}
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60"
      >
        {busy ? t("orders.preparing_invoice") : `📄 ${t("orders.download_invoice")}`}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

"use client";

import { useState } from "react";

// Fetches the PDF and saves it directly instead of navigating to the
// endpoint, so no new tab/viewer pops up over the order page.
export default function DownloadInvoiceButton({
  orderId,
  orderNumber,
}: {
  orderId: string;
  orderNumber?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/invoice`);
      if (!res.ok) throw new Error("Could not generate the invoice.");
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
      setError(err instanceof Error ? err.message : "Could not download the invoice.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60"
      >
        {busy ? "Preparing invoice..." : "📄 Download Invoice"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

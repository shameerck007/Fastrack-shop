"use client";


import { errorText } from "@/lib/errors";
import { useState } from "react";
import { useLocale } from "@/components/LocaleProvider";

// Same fetch-then-save pattern as DownloadInvoiceButton, for the same
// reason: no new tab/viewer popping up over the order page.
export default function DownloadLabelButton({
  orderId,
  orderNumber,
}: {
  orderId: string;
  orderNumber?: string;
}) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The label size matches the printer, so it is remembered on this device.
  const [size, setSize] = useState(() => {
    try {
      const saved = typeof window === "undefined" ? null : localStorage.getItem("label-size");
      return saved === "4x3" || saved === "a6" ? saved : "4x6";
    } catch {
      return "4x6";
    }
  });

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/label?size=${size}`);
      if (!res.ok) throw new Error(t("orders.could_not_generate_label"));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `label-${orderNumber ?? orderId}-${size}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      setError(errorText(err, t("orders.could_not_download_label")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <select
        suppressHydrationWarning
        value={size}
        onChange={(e) => {
          setSize(e.target.value);
          try {
            localStorage.setItem("label-size", e.target.value);
          } catch {
            // ignore
          }
        }}
        aria-label="Label size"
        className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs text-neutral-700"
      >
        <option value="4x6">4 × 6 in · 100 × 150 mm</option>
        <option value="4x3">4 × 3 in · 100 × 75 mm (compact)</option>
        <option value="a6">A6 · 105 × 148 mm</option>
      </select>
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-4 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
      >
        {busy ? t("orders.preparing_label") : t("orders.print_label")}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

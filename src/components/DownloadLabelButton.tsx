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
    <span className="relative inline-flex">
      <span className="inline-flex h-9 items-stretch overflow-hidden rounded-full border border-neutral-300 bg-white shadow-sm">
        <button type="button" onClick={download} disabled={busy} className="inline-flex items-center gap-1.5 pl-4 pr-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60">
          {busy ? t("orders.preparing_label") : t("orders.print_label")}
        </button>
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
          title="Label size"
          className="cursor-pointer border-l border-neutral-200 bg-neutral-50 py-0 pl-2.5 pr-1.5 text-xs font-semibold text-neutral-600 outline-none hover:bg-neutral-100"
        >
          <option value="4x6">4×6 in</option>
          <option value="4x3">4×3 in</option>
          <option value="a6">A6</option>
        </select>
      </span>
      {error && <span className="absolute left-0 top-full mt-1 whitespace-nowrap text-xs text-red-600">{error}</span>}
    </span>
  );
}

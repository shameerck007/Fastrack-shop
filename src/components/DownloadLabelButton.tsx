"use client";

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

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/label`);
      if (!res.ok) throw new Error(t("orders.could_not_generate_label"));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `label-${orderNumber ?? orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("orders.could_not_download_label"));
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
        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-4 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
      >
        {busy ? t("orders.preparing_label") : t("orders.print_label")}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

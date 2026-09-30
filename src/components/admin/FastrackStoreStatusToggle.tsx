"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminSetWarehouseActive } from "@/lib/actions/admin-fastrack-store";
import { useLocale } from "@/components/LocaleProvider";

export default function FastrackStoreStatusToggle({ warehouseId, isActive }: { warehouseId: string; isActive: boolean }) {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function toggle() {
    setError(null);
    startTransition(async () => {
      try {
        await adminSetWarehouseActive(warehouseId, !isActive);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("fastrack_stores.could_not_update"));
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={toggle}
        disabled={pending}
        className={`rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-50 ${
          isActive
            ? "border border-red-300 text-red-600 hover:bg-red-50"
            : "bg-blue-700 text-white hover:bg-blue-800"
        }`}
      >
        {isActive ? t("fastrack_stores.deactivate") : t("fastrack_stores.activate")}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";

export default function StockCell({
  inventoryId,
  stock,
  minStock,
  updateAction,
}: {
  inventoryId: string;
  stock: number;
  minStock: number;
  updateAction: (inventoryId: string, stock: number) => Promise<void>;
}) {
  const { t } = useLocale();
  const [value, setValue] = useState(String(stock));
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    const num = Number(value);
    if (Number.isNaN(num) || num === stock) return;
    startTransition(async () => {
      await updateAction(inventoryId, num);
      router.refresh();
    });
  }

  const isLow = stock < minStock;

  function step(delta: number) {
    const num = Math.max(0, Number(value) + delta);
    setValue(String(num));
    startTransition(async () => {
      await updateAction(inventoryId, num);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium text-neutral-500">{t("stock_cell.stock")}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={pending}
          aria-label="Decrease stock"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-300 text-base hover:bg-neutral-50 disabled:opacity-50 sm:h-6 sm:w-6 sm:rounded sm:text-xs"
        >
          −
        </button>
        <input
          type="number"
          step="0.001"
          aria-label="Stock quantity"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          disabled={pending}
          className={`h-9 w-16 rounded border px-2 py-1 text-center text-sm sm:h-auto ${
            isLow ? "border-amber-400 bg-amber-50" : "border-neutral-300"
          }`}
        />
        <button
          type="button"
          onClick={() => step(1)}
          disabled={pending}
          aria-label="Increase stock"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-300 text-base hover:bg-neutral-50 disabled:opacity-50 sm:h-6 sm:w-6 sm:rounded sm:text-xs"
        >
          +
        </button>
        {isLow && <span title={t("stock_cell.below_minimum")}>⚠️</span>}
      </div>
    </div>
  );
}

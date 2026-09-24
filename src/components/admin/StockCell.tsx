"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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
      <span className="text-[11px] font-medium text-neutral-400">Stock</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={pending}
          className="flex h-6 w-6 items-center justify-center rounded border border-neutral-300 text-xs hover:bg-neutral-50 disabled:opacity-50"
        >
          −
        </button>
        <input
          type="number"
          step="0.001"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          disabled={pending}
          className={`w-16 rounded border px-2 py-1 text-center text-sm ${
            isLow ? "border-amber-400 bg-amber-50" : "border-neutral-300"
          }`}
        />
        <button
          type="button"
          onClick={() => step(1)}
          disabled={pending}
          className="flex h-6 w-6 items-center justify-center rounded border border-neutral-300 text-xs hover:bg-neutral-50 disabled:opacity-50"
        >
          +
        </button>
        {isLow && <span title="Below minimum stock">⚠️</span>}
      </div>
    </div>
  );
}

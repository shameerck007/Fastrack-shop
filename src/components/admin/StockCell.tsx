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

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        step="0.001"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        disabled={pending}
        className={`w-20 rounded border px-2 py-1 text-sm ${
          isLow ? "border-amber-400 bg-amber-50" : "border-neutral-300"
        }`}
      />
      {isLow && <span title="Below minimum stock">⚠️</span>}
    </div>
  );
}

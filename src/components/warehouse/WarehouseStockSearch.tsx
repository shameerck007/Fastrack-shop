"use client";

import { useMemo, useState } from "react";
import StockCell from "@/components/admin/StockCell";
import { updateWarehouseStock } from "@/lib/actions/warehouse-staff";
import ReceiveStockButton from "@/components/warehouse/ReceiveStockButton";
import { useLocale } from "@/components/LocaleProvider";
import type { WarehouseStockRow } from "@/lib/warehouse-staff";

export default function WarehouseStockSearch({ stock, locale }: { stock: WarehouseStockRow[]; locale: string }) {
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all");

  const rows = useMemo(
    () =>
      stock.map((row) => ({
        ...row,
        displayName: locale === "ar" && row.productNameAr ? row.productNameAr : row.productName,
        displayVariant: locale === "ar" && row.variantLabelAr ? row.variantLabelAr : row.variantLabel,
        status: row.stock <= 0 ? ("out_of_stock" as const) : row.stock < row.minStock ? ("low_stock" as const) : ("in_stock" as const),
      })),
    [stock, locale]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!q) return true;
      return [row.displayName, row.displayVariant].some((field) => field.toLowerCase().includes(q));
    });
  }, [rows, query, statusFilter]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      inStock: rows.filter((r) => r.status === "in_stock").length,
      lowStock: rows.filter((r) => r.status === "low_stock").length,
      outOfStock: rows.filter((r) => r.status === "out_of_stock").length,
    }),
    [rows]
  );

  const STATUS_BADGE: Record<string, string> = {
    in_stock: "bg-emerald-50 text-emerald-700",
    low_stock: "bg-amber-50 text-amber-700",
    out_of_stock: "bg-red-50 text-red-600",
  };
  const STATUS_LABEL: Record<string, string> = {
    in_stock: t("warehouse.status_in_stock"),
    low_stock: t("warehouse.status_low_stock"),
    out_of_stock: t("warehouse.status_out_of_stock"),
  };

  return (
    <>
      <div className="my-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`rounded-xl border p-4 text-start transition ${statusFilter === "all" ? "border-blue-300 bg-blue-50" : "border-neutral-200 bg-white hover:bg-neutral-50"}`}
        >
          <p className="text-sm text-neutral-500">{t("warehouse.total_products")}</p>
          <p className="text-2xl font-semibold text-neutral-900">{counts.total}</p>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("in_stock")}
          className={`rounded-xl border p-4 text-start transition ${statusFilter === "in_stock" ? "border-emerald-300 bg-emerald-50" : "border-neutral-200 bg-white hover:bg-neutral-50"}`}
        >
          <p className="text-sm text-neutral-500">{t("warehouse.status_in_stock")}</p>
          <p className="text-2xl font-semibold text-emerald-700">{counts.inStock}</p>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("low_stock")}
          className={`rounded-xl border p-4 text-start transition ${statusFilter === "low_stock" ? "border-amber-300 bg-amber-50" : "border-neutral-200 bg-white hover:bg-neutral-50"}`}
        >
          <p className="text-sm text-neutral-500">{t("warehouse.status_low_stock")}</p>
          <p className="text-2xl font-semibold text-amber-600">{counts.lowStock}</p>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("out_of_stock")}
          className={`rounded-xl border p-4 text-start transition ${statusFilter === "out_of_stock" ? "border-red-300 bg-red-50" : "border-neutral-200 bg-white hover:bg-neutral-50"}`}
        >
          <p className="text-sm text-neutral-500">{t("warehouse.status_out_of_stock")}</p>
          <p className="text-2xl font-semibold text-red-600">{counts.outOfStock}</p>
        </button>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("warehouse.search_stock_placeholder")}
        className="mb-4 w-full max-w-sm rounded-full border border-neutral-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
          <span className="text-4xl">🔍</span>
          <p className="text-sm text-neutral-500">{t("warehouse.no_stock_match_search")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <div className="flex flex-col divide-y divide-neutral-100">
            {filtered.map((row) => (
              <div key={row.inventoryId} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                    {row.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.imageUrl} alt={row.displayName} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-lg">📦</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-900">{row.displayName}</p>
                    <p className="text-xs text-neutral-400">{row.displayVariant}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[row.status]}`}>
                  {STATUS_LABEL[row.status]}
                </span>
                <ReceiveStockButton inventoryId={row.inventoryId} />
                <StockCell
                  inventoryId={row.inventoryId}
                  stock={row.stock}
                  minStock={row.minStock}
                  updateAction={updateWarehouseStock}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

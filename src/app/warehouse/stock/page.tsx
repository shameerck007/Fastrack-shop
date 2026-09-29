import { redirect } from "next/navigation";
import { getMyStaffWarehouse, getWarehouseStock } from "@/lib/warehouse-staff";
import { updateWarehouseStock } from "@/lib/actions/warehouse-staff";
import StockCell from "@/components/admin/StockCell";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

export default async function WarehouseStockPage() {
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const warehouse = await getMyStaffWarehouse();
  if (!warehouse) redirect("/");

  const stock = await getWarehouseStock(warehouse.id);

  return (
    <div>
      <h1 className="text-xl font-semibold">{t("warehouse.stock_title")}</h1>
      <p className="mt-1 text-sm text-neutral-500">{t("warehouse.stock_intro")}</p>

      {stock.length === 0 ? (
        <div className="mt-5 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
          <span className="text-4xl">📦</span>
          <p className="text-sm text-neutral-500">{t("warehouse.no_stock_yet")}</p>
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex flex-col divide-y divide-neutral-100">
            {stock.map((row) => {
              const name = locale === "ar" && row.productNameAr ? row.productNameAr : row.productName;
              const variantLabel = locale === "ar" && row.variantLabelAr ? row.variantLabelAr : row.variantLabel;
              return (
                <div key={row.inventoryId} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-neutral-200 bg-neutral-50">
                      {row.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.imageUrl} alt={name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-sm">📦</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{name}</p>
                      <p className="text-xs text-neutral-400">{variantLabel}</p>
                    </div>
                  </div>
                  <StockCell
                    inventoryId={row.inventoryId}
                    stock={row.stock}
                    minStock={row.minStock}
                    updateAction={updateWarehouseStock}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

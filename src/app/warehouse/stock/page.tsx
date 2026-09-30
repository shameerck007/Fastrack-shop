import { redirect } from "next/navigation";
import { getMyStaffWarehouse, getWarehouseStock } from "@/lib/warehouse-staff";
import WarehouseStockSearch from "@/components/warehouse/WarehouseStockSearch";
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
        <WarehouseStockSearch stock={stock} locale={locale} />
      )}
    </div>
  );
}

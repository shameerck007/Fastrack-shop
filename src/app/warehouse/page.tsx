import LandingPreferenceCard from "@/components/LandingPreferenceCard";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getMyStaffWarehouse,
  getWarehouseOrders,
  getWarehouseStock,
  summarizeWarehouseOrders,
} from "@/lib/warehouse-staff";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

export default async function WarehouseDashboardPage() {
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const warehouse = await getMyStaffWarehouse();
  if (!warehouse) redirect("/");

  const [orders, stock] = await Promise.all([getWarehouseOrders(), getWarehouseStock(warehouse.id)]);
  const kpis = summarizeWarehouseOrders(orders);
  const outOfStockCount = stock.filter((r) => r.stock <= 0).length;
  const lowStockCount = stock.filter((r) => r.stock > 0 && r.stock < r.minStock).length;

  const stats = [
    { label: t("merchant.new_orders"), value: kpis.newCount, icon: "🆕", color: "bg-amber-50 text-amber-700", href: "/warehouse/orders" },
    { label: t("merchant.preparing_orders"), value: kpis.preparingCount, icon: "👨‍🍳", color: "bg-blue-50 text-blue-700", href: "/warehouse/orders" },
    { label: t("merchant.ready_orders"), value: kpis.readyCount, icon: "📦", color: "bg-emerald-50 text-emerald-700", href: "/warehouse/orders" },
    {
      label: t("warehouse.status_out_of_stock"),
      value: outOfStockCount,
      icon: "⚠️",
      color: outOfStockCount > 0 ? "bg-red-50 text-red-600" : "bg-neutral-50 text-neutral-500",
      href: "/warehouse/stock",
    },
  ];

  const lowStockPreview = stock
    .filter((r) => r.stock < r.minStock)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 5);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">{t("warehouse.welcome_back", { name: warehouse.name })}</h1>
      <p className="mb-6 text-sm text-neutral-500">{t("warehouse.dashboard_intro")}</p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-xl border border-neutral-200 bg-white p-4 transition hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <span className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${s.color}`}>
                {s.icon}
              </span>
              <div>
                <p className="text-sm text-neutral-500">{s.label}</p>
                <p className="text-2xl font-semibold">{s.value}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <Link
          href="/warehouse/orders"
          className="inline-flex items-center gap-1 rounded-full bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          {t("warehouse.manage_orders")}
        </Link>
        <Link
          href="/warehouse/stock"
          className="inline-flex items-center gap-1 rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
        >
          {t("warehouse.manage_stock")}
        </Link>
      </div>

      {lowStockPreview.length > 0 && (
        <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">{t("warehouse.needs_attention")}</p>
            <Link href="/warehouse/stock" className="text-xs text-blue-600 hover:underline">
              {t("warehouse.manage_stock")}
            </Link>
          </div>
          <div className="flex flex-col divide-y divide-neutral-100">
            {lowStockPreview.map((row) => {
              const name = locale === "ar" && row.productNameAr ? row.productNameAr : row.productName;
              return (
                <div key={row.inventoryId} className="flex items-center justify-between gap-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md border border-neutral-200 bg-neutral-50">
                      {row.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.imageUrl} alt={name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-sm">📦</span>
                      )}
                    </div>
                    <p className="truncate text-sm font-medium">{name}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium ${row.stock <= 0 ? "text-red-600" : "text-amber-600"}`}>
                    {t("warehouse.units_left", { count: row.stock })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="mt-6">
        <LandingPreferenceCard />
      </div>
    </div>
  );
}

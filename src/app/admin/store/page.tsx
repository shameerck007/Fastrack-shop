import Link from "@/components/Link";
import { getFastrackWarehouses } from "@/lib/fastrack-store";

import AddFastrackStoreForm from "@/components/admin/AddFastrackStoreForm";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import { getMoney } from "@/lib/tenant-server";

function Stat({ icon, label, value, accent }: { icon: string; label: string; value: string | number; accent: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
        style={{ background: `${accent}1a`, color: accent }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-neutral-500">{label}</p>
        <p className="text-2xl font-semibold leading-tight text-neutral-900">{value}</p>
      </div>
    </div>
  );
}

function initials(name: string): string {
  const words = name.replace(/[—-].*/, "").trim().split(/\s+/);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default async function AdminFastrackStoresPage() {
  const money = await getMoney();
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const warehouses = await getFastrackWarehouses();

  const activeCount = warehouses.filter((w) => w.is_active).length;
  const totalRevenue30d = warehouses.reduce((sum, w) => sum + w.revenue30d, 0);
  const totalOrders30d = warehouses.reduce((sum, w) => sum + w.orders30d, 0);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xl text-white shadow-sm">
            🏬
          </span>
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">{t("admin.fastrack_stores_title")}</h1>
            <p className="mt-0.5 max-w-2xl text-sm text-neutral-600">{t("admin.fastrack_stores_subtitle")}</p>
          </div>
        </div>
        <AddFastrackStoreForm />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon="🏬" label={t("fastrack_stores.total_locations")} value={warehouses.length} accent="#2563eb" />
        <Stat icon="✅" label={t("admin.approved")} value={activeCount} accent="#059669" />
        <Stat icon="🧾" label={t("admin.orders_30d")} value={totalOrders30d} accent="#7c3aed" />
        <Stat icon="📈" label={t("admin.revenue_30d")} value={money(totalRevenue30d)} accent="#d97706" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-neutral-700">{t("fastrack_stores.locations")}</h2>
        </div>

        {warehouses.length === 0 ? (
          <p className="p-6 text-sm text-neutral-500">{t("fastrack_stores.no_stores_yet")}</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {warehouses.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/admin/store/${w.id}`}
                  className="flex flex-wrap items-center gap-4 px-5 py-4 transition hover:bg-neutral-50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    {initials(w.name)}
                  </span>
                  <div className="min-w-[10rem] flex-1">
                    <p className="flex items-center gap-2 truncate font-medium text-neutral-900">
                      {w.name}
                      {w.is_default && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                          {t("fastrack_stores.default_badge")}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-neutral-500">{w.address_line ?? "—"}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      w.is_active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"
                    }`}
                  >
                    {w.is_active ? t("fastrack_stores.active") : t("fastrack_stores.inactive")}
                  </span>
                  <span className="hidden shrink-0 text-xs text-neutral-500 sm:block">
                    {t("fastrack_stores.orders_count", { count: w.orders30d })}
                  </span>
                  <span className="hidden shrink-0 text-xs font-medium text-neutral-700 sm:block">
                    {money(w.revenue30d)}
                  </span>
                  <span className="ms-auto shrink-0 text-xs font-medium text-blue-600">{t("fastrack_stores.view_details")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

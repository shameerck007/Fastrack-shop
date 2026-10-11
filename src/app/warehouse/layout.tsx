import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getMyStaffWarehouse } from "@/lib/warehouse-staff";
import PortalHeader from "@/components/PortalHeader";
import WarehouseNav from "@/components/warehouse/WarehouseNav";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

export default async function WarehouseLayout({ children }: { children: React.ReactNode }) {
  await requireRole("store_staff");
  const warehouse = await getMyStaffWarehouse();
  if (!warehouse) redirect("/");
  const locale = await getServerLocale();
  const t = (key: string) => translate(locale, key);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/70 via-neutral-50 to-neutral-50">
      <PortalHeader
        homeHref="/warehouse"
        title={warehouse.name}
        subtitle={t("warehouse.store_center")}
        chip={t("warehouse.staff_badge")}
        backLabel={t("portal.back_to_shop")}
        logoutLabel={t("portal.log_out")}
      />

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-5">
        <aside className="w-48 shrink-0 md:sticky md:top-[4.25rem] md:max-h-[calc(100dvh-5rem)] md:self-start md:overflow-y-auto">
          <WarehouseNav />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

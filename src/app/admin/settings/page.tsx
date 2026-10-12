import { getCompanySettings } from "@/lib/company-settings";
import { PageHeader } from "@/components/admin/AdminUi";
import BusinessSettings from "@/components/admin/BusinessSettings";
import StorefrontSettingsCard from "@/components/admin/StorefrontSettingsCard";
import { marketUi } from "@/lib/market-ui";
import { getCurrentTenant } from "@/lib/tenant-server";
import ReturnSettingsCard from "@/components/admin/ReturnSettingsCard";
import ScanSettingsCard from "@/components/admin/ScanSettingsCard";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

export const metadata = { title: "Business settings" };

export default async function AdminSettingsPage() {
  const locale = await getServerLocale();
  const t = (key: string) => translate(locale, key);
  const settings = await getCompanySettings();
  const tenant = await getCurrentTenant().catch(() => null);

  return (
    <div>
      <PageHeader icon="⚙️" title={t("admin.business_settings_title")} subtitle="Company details on invoices, rider pay and delivery time. Use Edit on a card to change it." />
      <BusinessSettings settings={settings} />
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <StorefrontSettingsCard showShops={settings.show_shops ?? null} marketDefault={marketUi(tenant?.country_code).showShops} />
        <ReturnSettingsCard defaultWindowDays={settings.default_return_window_days ?? 7} autoApprove={settings.return_auto_approve ?? true} />
        <ScanSettingsCard requirePickupScan={!!settings.require_pickup_scan} requirePackScan={!!settings.require_pack_scan} />
      </div>
    </div>
  );
}

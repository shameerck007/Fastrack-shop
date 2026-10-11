import { getCompanySettings } from "@/lib/company-settings";
import { PageHeader } from "@/components/admin/AdminUi";
import BusinessSettings from "@/components/admin/BusinessSettings";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

export const metadata = { title: "Business settings" };

export default async function AdminSettingsPage() {
  const locale = await getServerLocale();
  const t = (key: string) => translate(locale, key);
  const settings = await getCompanySettings();

  return (
    <div>
      <PageHeader icon="⚙️" title={t("admin.business_settings_title")} subtitle="Company details on invoices, rider pay and delivery time. Use Edit on a card to change it." />
      <BusinessSettings settings={settings} />
    </div>
  );
}

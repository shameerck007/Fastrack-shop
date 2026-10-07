import { getCompanySettings } from "@/lib/company-settings";
import { PageHeader } from "@/components/admin/AdminUi";
import CompanySettingsForm from "@/components/admin/CompanySettingsForm";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

export default async function AdminSettingsPage() {
  const locale = await getServerLocale();
  const t = (key: string) => translate(locale, key);
  const settings = await getCompanySettings();

  return (
    <div>
      <PageHeader icon="⚙️" title={t("admin.business_settings_title")} subtitle="Company details on invoices, rider settings and delivery time." />
      <div className="mt-3 max-w-2xl">
        <CompanySettingsForm settings={settings} />
      </div>
    </div>
  );
}

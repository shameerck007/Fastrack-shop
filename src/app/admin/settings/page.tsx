import { getCompanySettings } from "@/lib/company-settings";
import CompanySettingsForm from "@/components/admin/CompanySettingsForm";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

export default async function AdminSettingsPage() {
  const locale = await getServerLocale();
  const t = (key: string) => translate(locale, key);
  const settings = await getCompanySettings();

  return (
    <div>
      <h1 className="text-xl font-semibold">{t("admin.business_settings_title")}</h1>
      <p className="mt-1 text-sm text-neutral-500">{t("admin.business_settings_intro")}</p>
      <div className="mt-5 max-w-2xl">
        <CompanySettingsForm settings={settings} />
      </div>
    </div>
  );
}

import DashboardView, { RANGES } from "@/components/admin/dashboard/DashboardView";
import { getAdminDashboard, timeZoneFor } from "@/lib/admin-dashboard";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import { getCurrentTenant, getMoney } from "@/lib/tenant-server";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboardPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const sp = await searchParams;
  const asked = Number(sp.range);
  const days = (RANGES as readonly number[]).includes(asked) ? asked : 30;
  const [money, locale, tenant] = await Promise.all([getMoney(), getServerLocale(), getCurrentTenant()]);
  const data = await getAdminDashboard(days, timeZoneFor(tenant?.country_code));

  if (!data) {
    return (
      <div className="rounded-3xl bg-[#0b1220] p-6 text-white">
        <h1 className="text-xl font-extrabold">Business overview</h1>
        <p className="mt-3 rounded-xl border border-sky-300/30 bg-sky-400/10 p-4 text-sm text-sky-100">
          The business dashboard needs database migration <b>0083_admin_dashboard.sql</b>. Run it in the Supabase SQL editor, then reload this page.
        </p>
      </div>
    );
  }
  return <DashboardView data={data} days={days} money={money} t={(key) => translate(locale, key)} />;
}

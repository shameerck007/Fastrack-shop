import Link from "@/components/Link";
import { cookies } from "next/headers";
import { findCountry } from "@/lib/countries";
import { ADMIN_SCOPE_COOKIE } from "@/lib/platform-scope";
import { requireRole } from "@/lib/auth";
import AdminNav from "@/components/admin/AdminNav";
import PortalHeader from "@/components/PortalHeader";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import Flag from "@/components/Flag";

export const metadata = { title: { default: "Admin", template: "%s | FasTrack Admin" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole("admin");
  const scopeCountry = (await cookies()).get(ADMIN_SCOPE_COOKIE)?.value ?? null;
  const locale = await getServerLocale();
  const t = (key: string) => translate(locale, key);

  return (
    <div className="min-h-screen bg-neutral-50">
      <PortalHeader
        homeHref="/admin"
        title={t("admin.control_center")}
        subtitle="FasTrack Shop"
        chip={profile.full_name ?? "Admin"}
        backLabel={t("portal.back_to_shop")}
        logoutLabel={t("portal.log_out")}
        maxWidth="max-w-[90rem]"
      />

      {profile.role === "super_admin" && scopeCountry && (
        <div className="border-b border-brand-100 bg-brand-50">
          <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-3 px-4 py-1.5 text-sm text-brand-900">
            <span>
              <Flag code={scopeCountry} className="me-1.5 h-3.5 w-[18px] align-[-2px]" /> Working in <b>{findCountry(scopeCountry.toUpperCase()).name}</b> only
            </span>
            <Link href={`/platform/${scopeCountry}`} className="font-semibold text-brand-700 hover:underline">
              Switch country in Platform →
            </Link>
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-[90rem] flex-col gap-3 px-4 py-4 md:flex-row md:gap-6 md:py-5">
        <aside className="shrink-0 md:sticky md:top-[4.25rem] md:max-h-[calc(100dvh-5rem)] md:w-52 md:self-start md:overflow-y-auto">
          <AdminNav />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

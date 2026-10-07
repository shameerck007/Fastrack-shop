import { redirect } from "next/navigation";
import Link from "@/components/Link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import MarketSwitcher from "@/components/MarketSwitcher";
import Flag from "@/components/Flag";
import { findCountry } from "@/lib/countries";
import { isMarketPinnedRole } from "@/lib/tenant";
import { getActiveTenants, getCurrentTenant } from "@/lib/tenant-server";
import LandingPreference from "@/components/LandingPreference";
import { dashboardPathForRole } from "@/lib/landing";
import LanguageToggle from "@/components/LanguageToggle";

function AccountTile({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-sm"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xl">
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="font-medium text-neutral-900">{title}</span>
        <span className="text-sm text-neutral-500">{description}</span>
      </span>
    </Link>
  );
}

export default async function AccountPage() {
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  const [tenants, currentTenant] = await Promise.all([getActiveTenants(), getCurrentTenant()]);

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const dashboardHref =
    profile?.role === "super_admin"
      ? "/platform"
      : profile?.role === "admin"
        ? "/admin"
        : profile?.role === "rider"
        ? "/rider"
        : profile?.role === "store_staff"
          ? "/warehouse"
          : "/merchant";
  const roleLabel =
    profile?.role === "admin" || profile?.role === "super_admin"
      ? t("account.role_admin")
      : profile?.role === "rider"
        ? t("account.role_rider")
        : profile?.role === "merchant"
          ? t("account.role_merchant")
          : profile?.role === "store_staff"
            ? t("account.role_store_staff")
            : "";

  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-8 md:pb-8">
      <h1 className="mb-1 text-2xl font-semibold max-md:hidden">{t("account.title")}</h1>
      <p className="mb-6 text-sm text-neutral-500">
        {profile?.full_name ?? user.email} · {user.email}
      </p>

      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4">
        <span className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xl">🌐</span>
          <span className="flex flex-col">
            <span className="font-medium text-neutral-900">{t("account.language_title")}</span>
            <span className="text-sm text-neutral-500">{t("account.language_desc")}</span>
          </span>
        </span>
        <LanguageToggle />
      </div>

      {currentTenant && tenants.length > 1 && (isMarketPinnedRole(profile?.role) ? (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4">
          <Flag code={currentTenant.country_code} className="h-6 w-8" />
          <span className="flex flex-col">
            <span className="font-medium text-neutral-900">🔒 {findCountry(currentTenant.country_code).name}</span>
            <span className="text-sm text-neutral-500">
              Your account works in {findCountry(currentTenant.country_code).name}, so the country can&apos;t be changed. To shop in another country, use a customer login.
            </span>
          </span>
        </div>
      ) : (
        <MarketSwitcher tenants={tenants} currentId={currentTenant.id} />
      ))}

      {dashboardPathForRole(profile?.role) && (
        <LandingPreference initial={profile?.landing_page === "shop" ? "shop" : "portal"} portalLabel={t("account.dashboard_tile_title", { role: roleLabel })} />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AccountTile
          href="/orders"
          icon="📦"
          title={t("account.orders_tile_title")}
          description={t("account.orders_tile_desc")}
        />
        <AccountTile
          href="/account/security"
          icon="🔒"
          title={t("account.security_tile_title")}
          description={t("account.security_tile_desc")}
        />
        <AccountTile
          href="/addresses"
          icon="📍"
          title={t("account.addresses_tile_title")}
          description={t("account.addresses_tile_desc")}
        />
        <AccountTile
          href="/account/payments"
          icon="💳"
          title={t("account.payments_tile_title")}
          description={t("account.payments_tile_desc")}
        />
        <AccountTile
          href="/account/lists"
          icon="🤍"
          title={t("account.lists_tile_title")}
          description={t("account.lists_tile_desc")}
        />

        {(profile?.role === "admin" ||
          profile?.role === "super_admin" ||
          profile?.role === "rider" ||
          profile?.role === "merchant" ||
          profile?.role === "store_staff") && (
          <AccountTile
            href={dashboardHref}
            icon="🧭"
            title={t("account.dashboard_tile_title", { role: roleLabel })}
            description={t("account.dashboard_tile_desc")}
          />
        )}

        {profile?.role === "customer" && (
          <AccountTile
            href="/sell"
            icon="🏪"
            title={t("account.sell_tile_title")}
            description={t("account.sell_tile_desc")}
          />
        )}

        {profile?.role === "customer" && (
          <AccountTile
            href="/deliver"
            icon="🛵"
            title={t("account.deliver_tile_title")}
            description={t("account.deliver_tile_desc")}
          />
        )}
      </div>

      <form action={signOut} className="mt-6">
        <button className="flex w-full items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4 text-start transition hover:border-red-300 hover:shadow-sm sm:w-auto">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-xl">
            🚪
          </span>
          <span className="flex flex-col">
            <span className="font-medium text-neutral-900">{t("account.logout_tile_title")}</span>
            <span className="text-sm text-neutral-500">{t("account.logout_tile_desc")}</span>
          </span>
        </button>
      </form>
    </div>
  );
}

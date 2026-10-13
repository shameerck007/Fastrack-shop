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

export const metadata = { title: "Your account" };

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
      className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xl">
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
      <h1 className="mb-3 text-2xl font-extrabold tracking-tight max-md:hidden">{t("account.title")}</h1>
      {(() => {
        const name = profile?.full_name?.trim() || user.email?.split("@")[0] || "";
        const initials = name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((w: string) => w[0]?.toUpperCase())
          .join("");
        return (
          <div className="relative mb-5 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-sky-500 p-5 text-white shadow-lg shadow-brand-700/20">
            <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
            <span aria-hidden className="pointer-events-none absolute -bottom-12 right-16 h-32 w-32 rounded-full bg-white/10" />
            <div className="relative flex items-center gap-4">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/20 text-2xl font-extrabold ring-2 ring-white/40 backdrop-blur">{initials || "👤"}</span>
              <div className="min-w-0">
                <p className="truncate text-xl font-extrabold leading-tight">{name}</p>
                <p className="truncate text-sm text-white/85">{user.email}</p>
                {profile?.phone && <p className="truncate text-xs text-white/75">📞 {profile.phone}</p>}
                {roleLabel && <span className="mt-1.5 inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold">{roleLabel}</span>}
              </div>
            </div>
          </div>
        );
      })()}

      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4">
        <span className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xl">🌐</span>
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

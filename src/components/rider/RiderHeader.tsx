import Link from "next/link";
import { getRiderProfile, getRiderTodayStats } from "@/lib/rider";
import { signOut } from "@/lib/actions/auth";
import { formatSAR } from "@/lib/utils";
import AvailabilityToggle from "@/components/rider/AvailabilityToggle";
import Logo from "@/components/Logo";
import LanguageToggle from "@/components/LanguageToggle";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

export default async function RiderHeader() {
  const [rider, stats] = await Promise.all([getRiderProfile(), getRiderTodayStats()]);
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-neutral-900 text-white">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/rider" className="flex items-center gap-2">
          <Logo size={32} />
          <div className="leading-tight">
            <p className="text-sm font-semibold">{rider?.profile.full_name ?? t("rider.rider")}</p>
            <p className="text-xs text-neutral-400">
              {t("rider.today_stat", { count: stats.deliveries, earnings: formatSAR(stats.earnings) })}
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <LanguageToggle className="border-neutral-700 text-neutral-300" />
          {rider && <AvailabilityToggle isAvailable={rider.deliveryPartner.is_available} />}
          <form action={signOut}>
            <button className="text-xs text-neutral-400 hover:text-white">{t("portal.log_out")}</button>
          </form>
        </div>
      </div>
    </header>
  );
}

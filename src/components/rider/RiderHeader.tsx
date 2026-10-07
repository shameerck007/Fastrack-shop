import Link from "@/components/Link";
import { getRiderTodayStats } from "@/lib/rider";
import { signOut } from "@/lib/actions/auth";

import Wordmark from "@/components/Wordmark";
import LanguageToggle from "@/components/LanguageToggle";
import NotificationBell from "@/components/NotificationBell";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import { getMoney } from "@/lib/tenant-server";

// The online/offline toggle lives on RiderProfileCard now, not here — having
// it in both places (as it briefly was) showed two "Online" pills at once.
export default async function RiderHeader() {
  const money = await getMoney();
  const stats = await getRiderTodayStats();
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200/70 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/rider" className="flex min-w-0 shrink items-center gap-2">
          <Wordmark height={24} />
          <span className="hidden rounded-md bg-blue-50 px-2 py-0.5 text-sm font-semibold text-blue-700 sm:inline">
            {t("rider.rider")}
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-3">
          <Link href="/rider/earnings" className="hidden text-sm font-medium text-neutral-600 hover:text-blue-700 md:inline">
            Earnings
          </Link>
          <Link href="/rider/history" className="hidden text-sm font-medium text-neutral-600 hover:text-blue-700 md:inline">
            Trips
          </Link>
          <span className="hidden text-xs text-neutral-500 sm:inline">
            {t("rider.today_stat", { count: stats.deliveries, earnings: money(stats.earnings) })}
          </span>
          <Link href="/api/enter-shop" prefetch={false} className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900">
            <span className="rtl:-scale-x-100">←</span> <span className="hidden sm:inline">{t("portal.back_to_shop")}</span>
          </Link>
          <LanguageToggle />
          <NotificationBell />
          <form action={signOut}>
            <button className="text-sm text-neutral-500 hover:text-neutral-900">{t("portal.log_out")}</button>
          </form>
        </div>
      </div>
    </header>
  );
}

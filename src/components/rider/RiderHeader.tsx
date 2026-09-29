import Link from "next/link";
import { getRiderTodayStats } from "@/lib/rider";
import { signOut } from "@/lib/actions/auth";
import { formatSAR } from "@/lib/utils";
import Wordmark from "@/components/Wordmark";
import LanguageToggle from "@/components/LanguageToggle";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

// The online/offline toggle lives on RiderProfileCard now, not here — having
// it in both places (as it briefly was) showed two "Online" pills at once.
export default async function RiderHeader() {
  const stats = await getRiderTodayStats();
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);

  return (
    <header className="sticky top-0 z-30 bg-white shadow-sm">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/rider" className="flex items-center gap-2">
          <Wordmark height={24} />
          <span className="hidden rounded-md bg-blue-50 px-2 py-0.5 text-sm font-semibold text-blue-700 sm:inline">
            {t("rider.rider")}
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-neutral-500 sm:inline">
            {t("rider.today_stat", { count: stats.deliveries, earnings: formatSAR(stats.earnings) })}
          </span>
          <LanguageToggle />
          <form action={signOut}>
            <button className="text-sm text-neutral-500 hover:text-neutral-900">{t("portal.log_out")}</button>
          </form>
        </div>
      </div>
    </header>
  );
}

import Link from "@/components/Link";

import Wordmark from "@/components/Wordmark";
import NotificationBell from "@/components/NotificationBell";
import RiderMenu from "@/components/rider/RiderMenu";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

// Slim, app-style bar: logo and a Rider tag on the left, notifications and one menu button on the right.
// Today's earnings and the online switch live on the home screen, not here.
export default async function RiderHeader() {
  const locale = await getServerLocale();
  const t = (key: string) => translate(locale, key);

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200/70 bg-white/95 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-3 px-4">
        <Link href="/rider" className="flex min-w-0 items-center gap-2">
          <Wordmark height={24} />
          <span className="rounded-full bg-blue-700 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-white">
            {t("rider.rider")}
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          <NotificationBell />
          <RiderMenu backToShop={t("portal.back_to_shop")} logOut={t("portal.log_out")} />
        </div>
      </div>
    </header>
  );
}

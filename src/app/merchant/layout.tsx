import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";
import { getMyStore } from "@/lib/merchant";
import Wordmark from "@/components/Wordmark";
import MerchantNav from "@/components/merchant/MerchantNav";
import LanguageToggle from "@/components/LanguageToggle";
import NotificationBell from "@/components/NotificationBell";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  await requireRole("merchant");
  const store = await getMyStore();
  const locale = await getServerLocale();
  const t = (key: string) => translate(locale, key);

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-1.5 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <Link href="/merchant" className="shrink-0">
              <Wordmark height={24} />
            </Link>
            <div className="flex shrink-0 items-center gap-3 text-sm sm:gap-4">
              <Link href="/api/enter-shop" prefetch={false} className="flex items-center gap-1 text-neutral-500 hover:text-neutral-900">
                <span className="rtl:-scale-x-100">←</span> <span className="hidden sm:inline">{t("portal.back_to_shop")}</span>
              </Link>
              <LanguageToggle />
              <NotificationBell />
              <span className="hidden rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 sm:inline">
                ● {t("merchant.approved_seller")}
              </span>
              <form action={signOut}>
                <button className="text-neutral-500 hover:text-neutral-900">{t("portal.log_out")}</button>
              </form>
            </div>
          </div>
          <Link href="/merchant" className="block min-w-0">
            <span className="block truncate font-semibold leading-tight text-neutral-900">
              {store?.name ?? "FasTrack Merchant"}
            </span>
            <span className="block truncate text-xs leading-tight text-neutral-400">{t("merchant.seller_center")}</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <aside className="w-48 shrink-0">
          <MerchantNav />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

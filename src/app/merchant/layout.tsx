import { requireRole } from "@/lib/auth";
import { getMyStore } from "@/lib/merchant";
import MerchantNav from "@/components/merchant/MerchantNav";
import PortalHeader from "@/components/PortalHeader";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

export const metadata = { title: { default: "Supplier portal", template: "%s | FasTrack Supplier" } };

export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  await requireRole("merchant");
  const store = await getMyStore();
  const locale = await getServerLocale();
  const t = (key: string) => translate(locale, key);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/70 via-neutral-50 to-neutral-50">
      <PortalHeader
        homeHref="/merchant"
        title={store?.name ?? "FasTrack Merchant"}
        subtitle={t("merchant.seller_center")}
        chip={store?.status === "approved" ? t("merchant.approved_seller") : null}
        backLabel={t("portal.back_to_shop")}
        logoutLabel={t("portal.log_out")}
      />

      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 md:flex-row md:gap-6 md:py-5">
        <aside className="shrink-0 md:sticky md:top-[4.25rem] md:max-h-[calc(100dvh-5rem)] md:w-52 md:self-start md:overflow-y-auto">
          <MerchantNav />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

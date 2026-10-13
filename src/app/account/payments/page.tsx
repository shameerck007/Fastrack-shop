import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import { getCurrentTenant } from "@/lib/tenant-server";
import { onlinePaymentsEnabled } from "@/lib/moyasar";
import { listSavedCards } from "@/lib/actions/payments";
import SavedCardsManager from "@/components/SavedCardsManager";

export const metadata = { title: "Payment methods" };

export default async function AccountPaymentsPage() {
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const tenant = await getCurrentTenant();
  const online = onlinePaymentsEnabled(tenant?.country_code);
  const cards = online ? await listSavedCards().catch(() => []) : [];

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-1 text-xl font-extrabold tracking-tight text-neutral-900">{t("account.payments_tile_title")}</h1>
      <p className="mb-4 text-sm text-neutral-500">
        {online ? "Pay by card or Apple Pay at checkout. Cards you choose to save appear here." : t("account.payments_tile_desc")}
      </p>

      {online && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-extrabold tracking-tight text-neutral-900">Saved cards</h2>
          {cards.length > 0 ? (
            <SavedCardsManager cards={cards} />
          ) : (
            <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-4 text-sm text-neutral-500">
              No saved cards yet. Tick &ldquo;Save this card for next time&rdquo; when you pay by card and it will be here.
            </p>
          )}
          <p className="mt-3 text-xs text-neutral-500">
            🔒 We never see or store your full card number or security code. Your card is kept securely by our payment provider, and you can remove it any time.
          </p>
        </section>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-bold text-neutral-900">💵 {t("account.cash_on_delivery")}</p>
        <p className="mt-1 text-sm text-neutral-500">{t("account.payments_tile_desc")}</p>
      </div>
    </div>
  );
}

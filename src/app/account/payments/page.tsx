import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

export default async function AccountPaymentsPage() {
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-4 text-xl font-semibold">{t("account.payments_tile_title")}</h1>
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <p className="flex items-center gap-2 text-sm font-medium text-neutral-900">
          💵 {t("account.cash_on_delivery")}
        </p>
        <p className="mt-1 text-sm text-neutral-500">{t("account.payments_tile_desc")}</p>
      </div>
    </div>
  );
}

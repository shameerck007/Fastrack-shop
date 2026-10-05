import { redirect } from "next/navigation";
import PageHero from "@/components/PageHero";
import { createClient } from "@/lib/supabase/server";
import { getMyRiderApplication } from "@/lib/rider";
import RiderApplicationForm from "@/components/rider/RiderApplicationForm";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

export default async function DeliverPage() {
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/deliver");

  const [application, { data: profile }] = await Promise.all([
    getMyRiderApplication(),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);

  if (application?.status === "approved") redirect("/rider");

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <PageHero
        icon="🛵"
        title={t("become_rider.title")}
        subtitle={t("become_rider.subtitle")}
        chips={["Flexible hours", "Weekly earnings", "Cash or bank payout"]}
      />

      {!application && <RiderApplicationForm />}

      {application?.status === "pending" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="font-medium text-amber-800">{t("become_rider.under_review_title")}</p>
          <p className="mt-1 text-sm text-amber-700">
            {t("become_rider.under_review_body", { name: profile?.full_name ?? "" })}
          </p>
        </div>
      )}

      {application?.status === "rejected" && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="font-medium text-red-800">{t("become_rider.not_approved_title")}</p>
          {application.rejection_reason && (
            <p className="mt-1 text-sm text-red-700">{application.rejection_reason}</p>
          )}
          <p className="mt-2 text-sm text-neutral-600">{t("become_rider.contact_support")}</p>
        </div>
      )}

      {application?.status === "suspended" && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="font-medium text-red-800">{t("become_rider.suspended_title")}</p>
          <p className="mt-1 text-sm text-neutral-600">{t("become_rider.suspended_body")}</p>
        </div>
      )}
    </div>
  );
}

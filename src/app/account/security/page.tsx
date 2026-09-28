import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import AccountSecurityForm from "@/components/AccountSecurityForm";

export default async function AccountSecurityPage() {
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <Link href="/account" className="mb-4 inline-block text-sm text-blue-600 hover:underline">
        ← {t("account_security.back_to_account")}
      </Link>
      <h1 className="mb-6 text-xl font-semibold">{t("account_security.title")}</h1>
      <AccountSecurityForm
        initialName={profile?.full_name ?? ""}
        initialPhone={profile?.phone ?? ""}
        email={user.email ?? ""}
      />
    </div>
  );
}

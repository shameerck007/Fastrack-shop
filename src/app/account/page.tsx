import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";

export default async function AccountPage() {
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-xl font-semibold">{t("account.title")}</h1>
      <div className="mb-6 space-y-1 text-sm">
        <p>
          <span className="text-neutral-500">{t("account.name")}:</span> {profile?.full_name ?? "—"}
        </p>
        <p>
          <span className="text-neutral-500">{t("account.email")}:</span> {user.email}
        </p>
        <p>
          <span className="text-neutral-500">{t("account.phone")}:</span> {profile?.phone ?? "—"}
        </p>
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <Link href="/orders" className="text-blue-600 hover:underline">
          {t("account.order_history")}
        </Link>
        <Link href="/addresses" className="text-blue-600 hover:underline">
          {t("account.manage_addresses")}
        </Link>
        {(profile?.role === "admin" || profile?.role === "rider" || profile?.role === "merchant") && (
          <Link
            href={
              profile.role === "admin" ? "/admin" : profile.role === "rider" ? "/rider" : "/merchant"
            }
            className="text-blue-600 hover:underline"
          >
            {t("account.go_to_dashboard", { role: profile.role })}
          </Link>
        )}
        {profile?.role === "customer" && (
          <Link href="/sell" className="text-blue-600 hover:underline">
            {t("account.sell_on_fastrack")}
          </Link>
        )}
      </div>

      <form action={signOut} className="mt-6">
        <button className="rounded-full border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100">
          {t("account.logout")}
        </button>
      </form>
    </div>
  );
}

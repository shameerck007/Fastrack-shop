import { createClient } from "@/lib/supabase/server";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import LandingPreference from "@/components/LandingPreference";

const ROLE_KEYS: Record<string, string> = {
  admin: "account.role_admin",
  rider: "account.role_rider",
  merchant: "account.role_merchant",
  store_staff: "account.role_store_staff",
};

/** The landing-page setting, loaded for the signed-in user. Dropped at the bottom
 * of each portal's home page so riders and sellers can change it without going
 * through the shop's Account page. */
export default async function LandingPreferenceCard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const roleKey = profile?.role ? ROLE_KEYS[profile.role] : undefined;
  if (!roleKey) return null;

  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  return (
    <LandingPreference
      initial={profile?.landing_page === "shop" ? "shop" : "portal"}
      portalLabel={t("account.dashboard_tile_title", { role: t(roleKey) })}
    />
  );
}

import { createClient } from "@/lib/supabase/server";
import type { HeroSlide } from "@/components/HomeHero";
import { bannerSlide, bannerStatus, type AutoBannerType, type BannerRow } from "@/lib/home-banners-utils";
import type { Locale } from "@/lib/i18n/config";

/** The banners the shop home page shows right now (switched on and inside their dates), in order. Empty when none, or before migration 0108 is in. */
export async function getLiveHomeBanners(locale: Locale, auto: Record<AutoBannerType, HeroSlide | null>): Promise<HeroSlide[]> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("home_banners")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at");
    if (error || !data) return [];
    const ar = locale === "ar";
    return (data as BannerRow[]).filter((b) => bannerStatus(b) === "live").flatMap((b) => {
      const slide = bannerSlide(b, ar, auto);
      return slide ? [slide] : [];
    });
  } catch {
    return [];
  }
}

import { createClient } from "@/lib/supabase/server";
import type { HeroSlide } from "@/components/HomeHero";
import { bannerStatus, type BannerRow } from "@/lib/home-banners-utils";
import type { Locale } from "@/lib/i18n/config";

/** The banners the shop home page shows right now (switched on and inside their dates), in order. Empty when none, or before migration 0108 is in. */
export async function getLiveHomeBanners(locale: Locale): Promise<HeroSlide[]> {
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
    return (data as BannerRow[]).filter((b) => bannerStatus(b) === "live").map((b) => ({
      id: `banner-${b.id}`,
      theme: b.theme,
      eyebrow: b.eyebrow ?? "",
      title: (ar && b.title_ar) || b.title,
      subtitle: (ar && b.subtitle_ar) || b.subtitle || "",
      cta: (ar && b.cta_label_ar) || b.cta_label || "",
      href: b.link_url ?? "",
      images: (b.photos ?? []).map((src) => ({ src, alt: "" })),
      cover: b.image_url ?? undefined,
    }));
  } catch {
    return [];
  }
}

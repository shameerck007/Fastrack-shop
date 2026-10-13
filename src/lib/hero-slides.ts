import type { HeroImage, HeroSlide } from "@/components/HomeHero";
import type { AutoBannerType } from "@/lib/home-banners-utils";
import type { getCategoriesWithChildren, getFeaturedProducts, getFreshTodayProducts, getOfferProducts } from "@/lib/catalog";

type Products = Awaited<ReturnType<typeof getFeaturedProducts>>;

export interface AutoSlideInput {
  t: (key: string, vars?: Record<string, string | number>) => string;
  money: (n: number) => string;
  categories: Awaited<ReturnType<typeof getCategoriesWithChildren>>;
  featured: Products;
  freshToday: Awaited<ReturnType<typeof getFreshTodayProducts>>;
  offers: Awaited<ReturnType<typeof getOfferProducts>>;
  freeEnabled: boolean;
  freeOver: number;
}

/** Banner photos come from the live catalog, so the home page always shows what is actually for sale. */
export const heroPhotos = (list: Products): HeroImage[] => list.filter((p) => p.image_url).slice(0, 4).map((p) => ({ src: p.image_url as string, alt: p.name }));

/** The slides the shop can build by itself from live data. A type is null while it has nothing to show (no photos, free delivery off). */
export function buildAutoSlides(i: AutoSlideInput): Record<AutoBannerType, HeroSlide | null> {
  const { t, money, categories, featured, freshToday, offers } = i;
  const dealPct = Math.max(
    0,
    ...offers.flatMap((p) => p.product_variants.map((v) => (v.compare_at_price && v.compare_at_price > v.price ? Math.round(((v.compare_at_price - v.price) / v.compare_at_price) * 100) : 0))),
  );
  // The welcome and free-delivery banners use the category photos (variety), the others use the products themselves.
  const catPhotos = (from: number, n: number): HeroImage[] =>
    categories.filter((c) => c.image_url).slice(from, from + n).map((c) => ({ src: c.image_url as string, alt: c.name }));

  return {
    welcome: {
      id: "welcome",
      theme: "blue",
      eyebrow: t("home.hero_eyebrow"),
      title: t("home.hero_title"),
      subtitle: t("home.hero_subtitle"),
      chips: i.freeEnabled ? [t("home.hero_chip_fast"), t("home.hero_chip_free", { amount: money(i.freeOver) })] : [t("home.hero_chip_fast")],
      cta: t("home.hero_cta"),
      href: "#offers",
      images: catPhotos(0, 3),
      art: "🛵",
    },
    fresh_today: freshToday.some((p) => p.image_url)
      ? { id: "fresh", theme: "green", eyebrow: t("home.hero_fresh_eyebrow"), title: t("home.hero_fresh_title"), subtitle: t("home.hero_fresh_sub"), cta: t("home.hero_fresh_cta"), href: "#fresh", images: heroPhotos(freshToday) }
      : null,
    deals: offers.some((p) => p.image_url)
      ? { id: "deals", theme: "orange", eyebrow: t("home.hero_deals_eyebrow"), title: dealPct >= 5 ? t("home.hero_deals_title", { pct: dealPct }) : t("home.hero_deals_title_plain"), subtitle: t("home.hero_deals_sub"), cta: t("home.hero_deals_cta"), href: "#offers", images: heroPhotos(offers) }
      : null,
    free_delivery: i.freeEnabled
      ? { id: "free", theme: "teal", eyebrow: t("home.hero_free_eyebrow"), title: t("home.hero_free_title", { amount: money(i.freeOver) }), subtitle: t("home.hero_free_sub"), cta: t("home.hero_free_cta"), href: "#offers", images: catPhotos(3, 3), art: "🚚" }
      : null,
    best_sellers: featured.some((p) => p.image_url)
      ? { id: "best", theme: "blue", eyebrow: t("home.hero_best_eyebrow"), title: t("home.hero_best_title"), subtitle: t("home.hero_best_sub"), cta: t("home.hero_best_cta"), href: "#best-sellers", images: heroPhotos(featured) }
      : null,
  };
}

/** The slides shown when no admin banner is live: the original four, in their original order. */
export function builtInSlides(auto: Record<AutoBannerType, HeroSlide | null>): HeroSlide[] {
  return (["welcome", "fresh_today", "deals", "free_delivery"] as const).map((k) => auto[k]).filter((s): s is HeroSlide => !!s);
}

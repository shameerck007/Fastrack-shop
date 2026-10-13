import { cookies } from "next/headers";
import { getMoney } from "@/lib/tenant-server";
import { getDeliveryPricing } from "@/lib/delivery-pricing";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dashboardPathForRole, SHOP_MODE_COOKIE } from "@/lib/landing";
import { getMyStaffWarehouse } from "@/lib/warehouse-staff";
import CategoryGrid from "@/components/CategoryGrid";
import HomeHero, { type HeroImage, type HeroSlide, type HeroTile } from "@/components/HomeHero";
import ShopsRow from "@/components/ShopsRow";
import { getMarketUi } from "@/lib/market-ui-server";
import ProductSection from "@/components/ProductSection";
import RecentlyViewed from "@/components/RecentlyViewed";
import BuyAgainSection from "@/components/BuyAgainSection";
import DeliveryGate from "@/components/DeliveryGate";
import {
  getCategoriesWithChildren,
  getFeaturedProducts,
  getFreshTodayProducts,
  getOfferProducts,
} from "@/lib/catalog";
import { getProductRatingsMap } from "@/lib/reviews";
import { getDefaultVariantStockMap } from "@/lib/inventory";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import HomeOffers from "@/components/HomeOffers";

/** Riders, suppliers, admins and warehouse staff land on their own portal by
 * default (their saved preference). "Back to shop" sets a session cookie so the
 * shop stays open for the rest of the visit. */
async function redirectToPortalIfPreferred() {
  const shopChoice = (await cookies()).get(SHOP_MODE_COOKIE)?.value;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  // "Back to shop" only counts for the user who chose it.
  if (shopChoice && shopChoice === user.id) return;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const target = dashboardPathForRole(profile?.role);
  if (!target || (profile?.landing_page ?? "portal") !== "portal") return;
  // A staff account with no warehouse assigned has no portal to land on.
  if (profile?.role === "store_staff" && !(await getMyStaffWarehouse())) return;
  redirect(target);
}

export default async function HomePage() {
  await redirectToPortalIfPreferred();
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const money = await getMoney();
  const [categories, featured, freshToday, offers] = await Promise.all([
    getCategoriesWithChildren(),
    getFeaturedProducts(),
    getFreshTodayProducts(),
    getOfferProducts(),
  ]);

  const allProducts = [...featured, ...freshToday, ...offers];
  const allIds = [...new Set(allProducts.map((p) => p.id))];
  const [ratingsMap, stockMap] = await Promise.all([
    getProductRatingsMap(allIds),
    getDefaultVariantStockMap(allProducts),
  ]);
  // Maps aren't serializable across the server/client boundary — plain
  // objects are, and the client-side product grid filters by the
  // shopper's chosen delivery location (Swiggy/Instamart-style: sellers
  // that can't reach them are left out of browsing rather than shown and
  // blocked).
  const ratings = Object.fromEntries(ratingsMap);
  const stock = Object.fromEntries(stockMap);

  const freePricing = await getDeliveryPricing();

  // Banner photos come from the live catalog, so the home page always shows what is actually for sale.
  const photos = (list: typeof featured): HeroImage[] => list.filter((p) => p.image_url).slice(0, 4).map((p) => ({ src: p.image_url as string, alt: p.name }));
  const dealPct = Math.max(
    0,
    ...offers.flatMap((p) => p.product_variants.map((v) => (v.compare_at_price && v.compare_at_price > v.price ? Math.round(((v.compare_at_price - v.price) / v.compare_at_price) * 100) : 0))),
  );
  // The welcome and free-delivery banners use the category photos (variety), the others use the products themselves.
  const catPhotos = (from: number, n: number): HeroImage[] =>
    categories.filter((c) => c.image_url).slice(from, from + n).map((c) => ({ src: c.image_url as string, alt: c.name }));
  const heroSlides: HeroSlide[] = [
    {
      id: "welcome",
      theme: "blue",
      eyebrow: t("home.hero_eyebrow"),
      title: t("home.hero_title"),
      subtitle: t("home.hero_subtitle"),
      chips: freePricing.freeEnabled ? [t("home.hero_chip_fast"), t("home.hero_chip_free", { amount: money(freePricing.freeOver) })] : [t("home.hero_chip_fast")],
      cta: t("home.hero_cta"),
      href: "#offers",
      images: catPhotos(0, 3),
      art: "🛵",
    },
    ...(freshToday.some((p) => p.image_url)
      ? [{ id: "fresh", theme: "green" as const, eyebrow: t("home.hero_fresh_eyebrow"), title: t("home.hero_fresh_title"), subtitle: t("home.hero_fresh_sub"), cta: t("home.hero_fresh_cta"), href: "#fresh", images: photos(freshToday) }]
      : []),
    ...(offers.some((p) => p.image_url)
      ? [{ id: "deals", theme: "orange" as const, eyebrow: t("home.hero_deals_eyebrow"), title: dealPct >= 5 ? t("home.hero_deals_title", { pct: dealPct }) : t("home.hero_deals_title_plain"), subtitle: t("home.hero_deals_sub"), cta: t("home.hero_deals_cta"), href: "#offers", images: photos(offers) }]
      : []),
    ...(freePricing.freeEnabled
      ? [{ id: "free", theme: "teal" as const, eyebrow: t("home.hero_free_eyebrow"), title: t("home.hero_free_title", { amount: money(freePricing.freeOver) }), subtitle: t("home.hero_free_sub"), cta: t("home.hero_free_cta"), href: "#offers", images: catPhotos(3, 3), art: "🚚" }]
      : []),
  ];
  const heroTiles: HeroTile[] = [
    ...(offers.some((p) => p.image_url) ? [{ id: "tile-deals", theme: "orange" as const, title: t("home.hero_tile_deals"), cta: t("home.hero_tile_cta"), href: "#offers", images: photos(offers) }] : []),
    ...(freshToday.some((p) => p.image_url) ? [{ id: "tile-fresh", theme: "green" as const, title: t("home.hero_tile_fresh"), cta: t("home.hero_tile_cta"), href: "#fresh", images: photos(freshToday) }] : []),
  ];

  return (
    <DeliveryGate>
      <div className="mx-auto max-w-6xl px-4 py-5">
        <HomeHero slides={heroSlides} tiles={heroTiles} />

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-extrabold tracking-tight">{t("home.shop_by_category")}</h2>
          <CategoryGrid categories={categories} />
        </section>

        {(await getMarketUi()).showShops && <ShopsRow />}

        <BuyAgainSection />
        <HomeOffers />
        <ProductSection id="offers" promo title={t("home.offers")} products={offers} ratings={ratings} stock={stock} />
        <ProductSection id="fresh" title={t("home.fresh_today")} products={freshToday} ratings={ratings} stock={stock} />
        <ProductSection
          title={t("home.best_sellers")}
          products={featured}
          ratings={ratings}
          stock={stock}
          emptyMessage={t("home.no_products_yet")}
        />

        <RecentlyViewed />
      </div>
    </DeliveryGate>
  );
}

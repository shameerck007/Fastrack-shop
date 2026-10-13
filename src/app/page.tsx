import { cookies } from "next/headers";
import { getMoney } from "@/lib/tenant-server";
import { getDeliveryPricing } from "@/lib/delivery-pricing";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dashboardPathForRole, SHOP_MODE_COOKIE } from "@/lib/landing";
import { getMyStaffWarehouse } from "@/lib/warehouse-staff";
import CategoryGrid from "@/components/CategoryGrid";
import HomeHero, { type HeroTile } from "@/components/HomeHero";
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
import { getLiveHomeBanners } from "@/lib/home-banners";
import { buildAutoSlides, builtInSlides, heroPhotos } from "@/lib/hero-slides";
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

  const autoSlides = buildAutoSlides({ t, money, categories, featured, freshToday, offers, freeEnabled: freePricing.freeEnabled, freeOver: freePricing.freeOver });
  const photos = heroPhotos;
  // Banners the admin has set up replace the built-in slides; with none live, the built-in ones show.
  const adminBanners = await getLiveHomeBanners(locale, autoSlides);
  const heroSlides = adminBanners.length > 0 ? adminBanners : builtInSlides(autoSlides);
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
          id="best-sellers"
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

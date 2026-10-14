import { getMoney } from "@/lib/tenant-server";
import { getDeliveryPricing } from "@/lib/delivery-pricing";
import { getCategoriesWithChildren, getFeaturedProducts, getFreshTodayProducts, getOfferProducts } from "@/lib/catalog";
import { buildAutoSlides } from "@/lib/hero-slides";
import { translate } from "@/lib/i18n/t";
import type { Locale } from "@/lib/i18n/config";

/** The automatic slides as they would look right now, for the admin's banner list and preview (the home page builds them from data it already has). */
export async function getAutoSlides(locale: Locale) {
  const [money, categories, featured, freshToday, offers, pricing] = await Promise.all([
    getMoney(),
    getCategoriesWithChildren(),
    getFeaturedProducts(),
    getFreshTodayProducts(),
    getOfferProducts(),
    getDeliveryPricing(),
  ]);
  return buildAutoSlides({
    t: (key, vars) => translate(locale, key, vars),
    money,
    categories,
    featured,
    freshToday,
    offers,
    freeEnabled: pricing.freeEnabled,
    freeOver: pricing.freeOver,
  });
}

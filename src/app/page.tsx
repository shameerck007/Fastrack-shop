import CategoryGrid from "@/components/CategoryGrid";
import ProductSection from "@/components/ProductSection";
import RecentlyViewed from "@/components/RecentlyViewed";
import BuyAgainSection from "@/components/BuyAgainSection";
import {
  getCategoriesWithChildren,
  getFeaturedProducts,
  getFreshTodayProducts,
  getOfferProducts,
} from "@/lib/catalog";
import { getProductRatingsMap } from "@/lib/reviews";
import { getDefaultVariantStockMap } from "@/lib/inventory";

export default async function HomePage() {
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Shop by category</h2>
        <CategoryGrid categories={categories} />
      </section>

      <BuyAgainSection />
      <ProductSection title="🏷️ Offers" products={offers} ratings={ratings} stock={stock} />
      <ProductSection title="🥬 Fresh Today" products={freshToday} ratings={ratings} stock={stock} />
      <ProductSection
        title="🔥 Best Sellers"
        products={featured}
        ratings={ratings}
        stock={stock}
        emptyMessage="No products yet — connect Supabase and run the seed script to populate the catalog."
      />

      <RecentlyViewed />
    </div>
  );
}

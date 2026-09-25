import CategoryGrid from "@/components/CategoryGrid";
import ProductCard from "@/components/ProductCard";
import RecentlyViewed from "@/components/RecentlyViewed";
import BuyAgainSection from "@/components/BuyAgainSection";
import {
  getCategories,
  getFeaturedProducts,
  getFreshTodayProducts,
  getOfferProducts,
} from "@/lib/catalog";
import { getProductRatingsMap, type ProductRating } from "@/lib/reviews";
import { getDefaultVariantStockMap } from "@/lib/inventory";
import type { ProductWithVariants } from "@/types/database";

function ProductSection({
  title,
  products,
  ratings,
  stock,
}: {
  title: string;
  products: ProductWithVariants[];
  ratings: Map<string, ProductRating>;
  stock: Map<string, number>;
}) {
  if (products.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            rating={ratings.get(product.id)}
            stock={stock.get(product.id)}
          />
        ))}
      </div>
    </section>
  );
}

export default async function HomePage() {
  const [categories, featured, freshToday, offers] = await Promise.all([
    getCategories(),
    getFeaturedProducts(),
    getFreshTodayProducts(),
    getOfferProducts(),
  ]);

  const allProducts = [...featured, ...freshToday, ...offers];
  const allIds = [...new Set(allProducts.map((p) => p.id))];
  const [ratings, stock] = await Promise.all([
    getProductRatingsMap(allIds),
    getDefaultVariantStockMap(allProducts),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Shop by category</h2>
        <CategoryGrid categories={categories} />
      </section>

      <BuyAgainSection />
      <ProductSection title="🏷️ Offers" products={offers} ratings={ratings} stock={stock} />
      <ProductSection title="🥬 Fresh Today" products={freshToday} ratings={ratings} stock={stock} />

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">🔥 Best Sellers</h2>
        {featured.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No products yet — connect Supabase and run the seed script to populate the catalog.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {featured.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                rating={ratings.get(product.id)}
                stock={stock.get(product.id)}
              />
            ))}
          </div>
        )}
      </section>

      <RecentlyViewed />
    </div>
  );
}

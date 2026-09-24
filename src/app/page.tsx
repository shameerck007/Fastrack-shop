import CategoryGrid from "@/components/CategoryGrid";
import Hero from "@/components/Hero";
import ProductCard from "@/components/ProductCard";
import { getCategories, getFeaturedProducts, getFreshTodayProducts, getOfferProducts } from "@/lib/catalog";

function ProductSection({
  title,
  products,
}: {
  title: string;
  products: Awaited<ReturnType<typeof getFeaturedProducts>>;
}) {
  if (products.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Hero />

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Shop by category</h2>
        <CategoryGrid categories={categories} />
      </section>

      <ProductSection title="🏷️ Offers" products={offers} />
      <ProductSection title="🥬 Fresh Today" products={freshToday} />

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">🔥 Best Sellers</h2>
        {featured.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No products yet — connect Supabase and run the seed script to populate the catalog.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

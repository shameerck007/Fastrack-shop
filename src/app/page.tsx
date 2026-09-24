import CategoryGrid from "@/components/CategoryGrid";
import ProductCard from "@/components/ProductCard";
import { getCategories, getFeaturedProducts } from "@/lib/catalog";

export default async function HomePage() {
  const [categories, featured] = await Promise.all([getCategories(), getFeaturedProducts()]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Shop by category</h2>
        <CategoryGrid categories={categories} />
      </section>

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

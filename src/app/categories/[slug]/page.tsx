import { notFound } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import Breadcrumbs from "@/components/Breadcrumbs";
import { getProductsByCategory } from "@/lib/catalog";
import { getProductRatingsMap } from "@/lib/reviews";
import { getDefaultVariantStockMap } from "@/lib/inventory";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { category, products } = await getProductsByCategory(slug);

  if (!category) notFound();

  const [ratings, stock] = await Promise.all([
    getProductRatingsMap(products.map((p) => p.id)),
    getDefaultVariantStockMap(products),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: category.name }]} />
      <h1 className="mb-4 text-xl font-semibold">{category.name}</h1>
      {products.length === 0 ? (
        <p className="text-sm text-neutral-500">No products in this category yet.</p>
      ) : (
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
      )}
    </div>
  );
}

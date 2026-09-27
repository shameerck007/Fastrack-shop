import { notFound } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import DeliverableProductList from "@/components/DeliverableProductList";
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

  const [ratingsMap, stockMap] = await Promise.all([
    getProductRatingsMap(products.map((p) => p.id)),
    getDefaultVariantStockMap(products),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: category.name }]} />
      <h1 className="mb-4 text-xl font-semibold">{category.name}</h1>
      <DeliverableProductList
        products={products}
        ratings={Object.fromEntries(ratingsMap)}
        stock={Object.fromEntries(stockMap)}
        emptyMessage="No products in this category yet."
      />
    </div>
  );
}

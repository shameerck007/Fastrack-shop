import { notFound } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import Breadcrumbs from "@/components/Breadcrumbs";
import { getApprovedStoreById, getStoreProducts } from "@/lib/catalog";
import { getProductRatingsMap } from "@/lib/reviews";
import { getDefaultVariantStockMap } from "@/lib/inventory";

export default async function StorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = await getApprovedStoreById(id);
  if (!store) notFound();

  const products = await getStoreProducts(id);
  const [ratings, stock] = await Promise.all([
    getProductRatingsMap(products.map((p) => p.id)),
    getDefaultVariantStockMap(products),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: store.name }]} />
      <div className="mb-4">
        <h1 className="text-xl font-semibold">{store.name}</h1>
        <p className="text-sm text-neutral-500">{store.city}</p>
      </div>
      {products.length === 0 ? (
        <p className="text-sm text-neutral-500">This store hasn&apos;t listed any products yet.</p>
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

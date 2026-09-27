import { notFound } from "next/navigation";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import DeliverableProductList from "@/components/DeliverableProductList";
import { getProductsByCategory } from "@/lib/catalog";
import { getProductRatingsMap } from "@/lib/reviews";
import { getDefaultVariantStockMap } from "@/lib/inventory";
import { getCategoryTheme } from "@/lib/categoryTheme";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { category, subcategories, parent, products } = await getProductsByCategory(slug);

  if (!category) notFound();

  const [ratingsMap, stockMap] = await Promise.all([
    getProductRatingsMap(products.map((p) => p.id)),
    getDefaultVariantStockMap(products),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          ...(parent ? [{ label: parent.name, href: `/categories/${parent.slug}` }] : []),
          { label: category.name },
        ]}
      />
      <h1 className="mb-1 text-xl font-semibold">{category.name}</h1>
      {subcategories.length > 0 && (
        <p className="mb-3 text-sm text-neutral-500">Showing all of {category.name}, or pick a subcategory below.</p>
      )}

      {subcategories.length > 0 && (
        <div className="mb-4 flex gap-3 overflow-x-auto pb-1">
          {subcategories.map((sub) => {
            const theme = getCategoryTheme(sub.slug);
            return (
              <Link
                key={sub.id}
                href={`/categories/${sub.slug}`}
                className="group flex shrink-0 flex-col items-center gap-1.5"
              >
                <div className="h-14 w-14 overflow-hidden rounded-xl border border-neutral-200 shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md">
                  {sub.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sub.image_url} alt={sub.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br text-2xl ${theme.gradient}`}>
                      {sub.icon || theme.emoji}
                    </div>
                  )}
                </div>
                <span className="max-w-[4.5rem] truncate text-center text-xs font-medium text-neutral-700">
                  {sub.name}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <DeliverableProductList
        products={products}
        ratings={Object.fromEntries(ratingsMap)}
        stock={Object.fromEntries(stockMap)}
        emptyMessage="No products in this category yet."
      />
    </div>
  );
}

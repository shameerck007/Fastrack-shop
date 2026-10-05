import { notFound } from "next/navigation";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import DeliverableProductList from "@/components/DeliverableProductList";
import DeliveryGate from "@/components/DeliveryGate";
import { MobileTitleBar } from "@/components/MobileTopBar";
import { getProductsByCategory } from "@/lib/catalog";
import { getProductRatingsMap } from "@/lib/reviews";
import { getDefaultVariantStockMap } from "@/lib/inventory";
import { getCategoryTheme } from "@/lib/categoryTheme";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import { localizedName } from "@/lib/i18n/localized";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const { category, subcategories, parent, products } = await getProductsByCategory(slug);

  if (!category) notFound();

  const [ratingsMap, stockMap] = await Promise.all([
    getProductRatingsMap(products.map((p) => p.id)),
    getDefaultVariantStockMap(products),
  ]);

  const categoryLabel = localizedName(category, locale);

  return (
    <div>
    <MobileTitleBar title={categoryLabel} />
    <div className="mx-auto max-w-6xl px-4 py-6 max-md:pb-36 max-md:pt-4">
      <div className="hidden md:block">
      <Breadcrumbs
        items={[
          { label: t("category.home"), href: "/" },
          ...(parent ? [{ label: localizedName(parent, locale), href: `/categories/${parent.slug}` }] : []),
          { label: categoryLabel },
        ]}
      />
      </div>
      <h1 className="mb-1 hidden text-xl font-semibold md:block">{categoryLabel}</h1>
      {subcategories.length > 0 && (
        <p className="mb-3 hidden text-sm text-neutral-500 md:block">{t("category.showing_all_of", { name: categoryLabel })}</p>
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
                <div className="h-14 w-14 overflow-hidden rounded-full border-2 border-white shadow-sm ring-1 ring-neutral-200 transition group-hover:-translate-y-0.5 group-hover:shadow-md">
                  {sub.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sub.image_url} alt={localizedName(sub, locale)} className="h-full w-full object-cover" />
                  ) : (
                    <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br text-2xl ${theme.gradient}`}>
                      {sub.icon || theme.emoji}
                    </div>
                  )}
                </div>
                <span className="max-w-[4.5rem] truncate text-center text-xs font-medium text-neutral-700">
                  {localizedName(sub, locale)}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <DeliveryGate>
        <DeliverableProductList
          products={products}
          ratings={Object.fromEntries(ratingsMap)}
          stock={Object.fromEntries(stockMap)}
          emptyMessage={t("category.no_products")}
        />
      </DeliveryGate>
    </div>
    </div>
  );
}

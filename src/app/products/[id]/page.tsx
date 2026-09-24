import { notFound } from "next/navigation";
import AddToCartForm from "@/components/AddToCartForm";
import { getProductById } from "@/lib/catalog";
import { formatSAR } from "@/lib/utils";
import { getCategoryTheme } from "@/lib/categoryTheme";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) notFound();

  const variant =
    product.product_variants.find((v) => v.is_default) ?? product.product_variants[0];
  const theme = getCategoryTheme(product.category?.slug);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="grid gap-8 md:grid-cols-2">
        <div
          className={`flex h-72 items-center justify-center rounded-2xl bg-gradient-to-br text-8xl ${theme.gradient}`}
        >
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt={product.name} className="h-full w-full rounded-2xl object-cover" />
          ) : (
            <span className="drop-shadow-sm">{theme.emoji}</span>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <p className="text-sm text-neutral-500">{product.brand}</p>
              {product.is_fresh && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  Fresh
                </span>
              )}
            </div>
            <h1 className="text-2xl font-semibold">{product.name}</h1>
            {product.name_ar && <p className="text-neutral-500" dir="rtl">{product.name_ar}</p>}
            {variant && <p className="text-sm text-neutral-500">{variant.label}</p>}
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-emerald-700">
              {variant ? formatSAR(variant.price) : "—"}
            </span>
            {variant?.compare_at_price && (
              <span className="text-neutral-400 line-through">
                {formatSAR(variant.compare_at_price)}
              </span>
            )}
            {product.is_variable_weight && product.price_per_kg && (
              <span className="text-xs text-neutral-500">
                ({formatSAR(product.price_per_kg)}/kg — final price adjusted to packed weight)
              </span>
            )}
          </div>

          {product.product_variants.length > 0 ? (
            <AddToCartForm variants={product.product_variants} isFresh={product.is_fresh} />
          ) : (
            <p className="text-sm text-red-600">Currently unavailable.</p>
          )}

          <dl className="grid grid-cols-2 gap-2 text-sm text-neutral-600">
            {product.origin && (
              <>
                <dt className="font-medium">Origin</dt>
                <dd>{product.origin}</dd>
              </>
            )}
            {product.category && (
              <>
                <dt className="font-medium">Category</dt>
                <dd>{product.category.name}</dd>
              </>
            )}
          </dl>

          {product.description && (
            <div>
              <h2 className="mb-1 font-medium">Description</h2>
              <p className="text-sm text-neutral-600">{product.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

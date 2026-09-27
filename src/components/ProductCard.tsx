import Link from "next/link";
import type { ProductWithVariants } from "@/types/database";
import { formatSAR } from "@/lib/utils";
import { getCategoryTheme } from "@/lib/categoryTheme";
import StarRating from "@/components/StarRating";
import type { ProductRating } from "@/lib/reviews";

export default function ProductCard({
  product,
  rating,
  stock,
}: {
  product: ProductWithVariants;
  rating?: ProductRating;
  stock?: number;
}) {
  const variant =
    product.product_variants.find((v) => v.is_default) ?? product.product_variants[0];
  const theme = getCategoryTheme(product.category?.slug);
  const discountPct =
    variant?.compare_at_price && variant.compare_at_price > variant.price
      ? Math.round((1 - variant.price / variant.compare_at_price) * 100)
      : null;
  const outOfStock = stock !== undefined && stock <= 0;

  return (
    <Link
      href={`/products/${product.id}`}
      className={`group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-neutral-200/60 ${
        outOfStock ? "opacity-60" : ""
      }`}
    >
      <div className={`relative flex h-32 items-center justify-center bg-gradient-to-br ${theme.gradient}`}>
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-5xl drop-shadow-sm transition group-hover:scale-110">
            {theme.emoji}
          </span>
        )}

        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {product.is_fresh && (
            <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-blue-700 shadow-sm">
              Fresh
            </span>
          )}
        </div>
        {outOfStock ? (
          <span className="absolute right-2 top-2 rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
            Out of stock
          </span>
        ) : (
          discountPct && (
            <span className="absolute right-2 top-2 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
              -{discountPct}%
            </span>
          )
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <span className="text-xs text-neutral-500">{product.brand}</span>
        <span className="line-clamp-2 text-sm font-medium text-neutral-900">{product.name}</span>
        {rating && rating.review_count > 0 && (
          <StarRating rating={rating.avg_rating} count={rating.review_count} />
        )}
        {variant && <span className="text-xs text-neutral-500">{variant.label}</span>}
        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-blue-700">
              {variant ? formatSAR(variant.price) : "—"}
            </span>
            {variant?.compare_at_price && (
              <span className="text-xs text-neutral-400 line-through">
                {formatSAR(variant.compare_at_price)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

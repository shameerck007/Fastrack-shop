import Link from "next/link";
import type { ProductWithVariants } from "@/types/database";
import { formatSAR } from "@/lib/utils";

export default function ProductCard({ product }: { product: ProductWithVariants }) {
  const variant =
    product.product_variants.find((v) => v.is_default) ?? product.product_variants[0];

  return (
    <Link
      href={`/products/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white transition hover:shadow-md"
    >
      <div className="flex h-32 items-center justify-center bg-neutral-100 text-4xl">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <span>🛒</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <span className="text-xs text-neutral-500">{product.brand}</span>
        <span className="line-clamp-2 text-sm font-medium text-neutral-900">{product.name}</span>
        {variant && <span className="text-xs text-neutral-500">{variant.label}</span>}
        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-emerald-700">
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

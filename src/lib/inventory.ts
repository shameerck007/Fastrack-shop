import { createClient } from "@/lib/supabase/server";
import type { ProductWithVariants } from "@/types/database";

export async function getVariantStockMap(variantIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (variantIds.length === 0) return map;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory")
    .select("variant_id, stock")
    .in("variant_id", variantIds);

  if (error) throw error;
  for (const row of data ?? []) {
    map.set(row.variant_id, (map.get(row.variant_id) ?? 0) + Number(row.stock));
  }
  return map;
}

export async function getVariantStock(variantId: string): Promise<number> {
  const map = await getVariantStockMap([variantId]);
  return map.get(variantId) ?? 0;
}

/** Maps product id -> stock of that product's default (or first) variant, for list views. */
export async function getDefaultVariantStockMap(
  products: ProductWithVariants[]
): Promise<Map<string, number>> {
  const defaultVariantByProduct = new Map(
    products.map((p) => [
      p.id,
      (p.product_variants.find((v) => v.is_default) ?? p.product_variants[0])?.id,
    ])
  );
  const variantIds = [...defaultVariantByProduct.values()].filter((id): id is string => !!id);
  const stockByVariant = await getVariantStockMap(variantIds);

  const map = new Map<string, number>();
  for (const [productId, variantId] of defaultVariantByProduct) {
    if (variantId) map.set(productId, stockByVariant.get(variantId) ?? 0);
  }
  return map;
}

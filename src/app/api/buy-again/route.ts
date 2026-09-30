import { NextResponse } from "next/server";
import { getBuyAgainProducts } from "@/lib/orders";
import { getProductRatingsMap } from "@/lib/reviews";
import { getDefaultVariantStockMap } from "@/lib/inventory";

export async function GET() {
  const products = await getBuyAgainProducts();
  if (products.length === 0) {
    return NextResponse.json({ products: [], ratings: {}, stock: {} });
  }

  const ids = products.map((p) => p.id);
  const [ratings, stock] = await Promise.all([
    getProductRatingsMap(ids),
    getDefaultVariantStockMap(products),
  ]);

  return NextResponse.json({
    products,
    ratings: Object.fromEntries(ratings),
    stock: Object.fromEntries(stock),
  });
}

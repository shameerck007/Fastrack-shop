import { redirect } from "next/navigation";
import CheckoutForm from "@/components/CheckoutForm";
import { getCartItems, cartSubtotal } from "@/lib/cart";
import { getAddresses } from "@/lib/addresses";
import { checkProductsDeliverable } from "@/lib/delivery-zones";

export default async function CheckoutPage() {
  const [items, addresses] = await Promise.all([getCartItems(), getAddresses()]);

  if (items.length === 0) redirect("/cart");

  const subtotal = cartSubtotal(items);

  // For each saved address, which cart items the sellers can't deliver there.
  const products = items.map((i) => ({
    id: i.product_variants.products.id,
    store_id: i.product_variants.products.store_id,
    name: i.product_variants.products.name,
  }));
  const blockedByAddress: Record<string, string[]> = {};
  await Promise.all(
    addresses.map(async (a) => {
      const results = await checkProductsDeliverable(products, { lat: a.lat, lng: a.lng });
      const names = products.filter((p) => results.get(p.id)?.message).map((p) => p.name);
      if (names.length > 0) blockedByAddress[a.id] = names;
    })
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">Checkout</h1>
      <CheckoutForm addresses={addresses} subtotal={subtotal} blockedByAddress={blockedByAddress} />
    </div>
  );
}

import { redirect } from "next/navigation";
import CheckoutForm from "@/components/CheckoutForm";
import { getCartItems, cartSubtotal } from "@/lib/cart";
import { getAddresses } from "@/lib/addresses";
import { checkProductsDeliverable } from "@/lib/delivery-zones";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import { localizedName } from "@/lib/i18n/localized";

export default async function CheckoutPage() {
  const locale = await getServerLocale();
  const t = (key: string) => translate(locale, key);
  const [items, addresses] = await Promise.all([getCartItems(), getAddresses()]);

  if (items.length === 0) redirect("/cart");

  const subtotal = cartSubtotal(items);

  // For each saved address, which cart items the sellers can't deliver there.
  const products = items.map((i) => ({
    id: i.product_variants.products.id,
    store_id: i.product_variants.products.store_id,
    name: localizedName(i.product_variants.products, locale),
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
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">{t("checkout.title")}</h1>
      <CheckoutForm addresses={addresses} items={items} subtotal={subtotal} blockedByAddress={blockedByAddress} />
    </div>
  );
}

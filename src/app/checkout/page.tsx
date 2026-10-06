import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/tenant-server";
import { deliveryTaxRate, extractTax, productTaxRate, taxProfileFor } from "@/lib/tax";
import CheckoutForm from "@/components/CheckoutForm";
import { getCartItems, cartSubtotal } from "@/lib/cart";
import { getAddresses } from "@/lib/addresses";
import { checkProductsDeliverable } from "@/lib/delivery-zones";
import { stateInServiceArea } from "@/lib/india";
import { combineMethods } from "@/lib/delivery-methods";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import { getStoreDirectory } from "@/lib/stores";
import { localizedName } from "@/lib/i18n/localized";

export default async function CheckoutPage() {
  const locale = await getServerLocale();
  const t = (key: string) => translate(locale, key);
  const [items, addresses] = await Promise.all([getCartItems(), getAddresses()]);

  if (items.length === 0) redirect("/cart");

  const subtotal = cartSubtotal(items);
  // Tax already inside the prices, per item at each product's own rate (GST slabs / VAT).
  const tenant = await getCurrentTenant();
  const taxProfile = taxProfileFor(tenant?.country_code);
  const taxTotal =
    Math.round(
      items.reduce((sum, i) => sum + extractTax(i.quantity * i.product_variants.price, productTaxRate(i.product_variants.products, tenant?.country_code)), 0) * 100
    ) / 100;

  // For each saved address, which cart items the sellers can't deliver there.
  const products = items.map((i) => ({
    id: i.product_variants.products.id,
    store_id: i.product_variants.products.store_id,
    name: localizedName(i.product_variants.products, locale),
  }));
  const blockedByAddress: Record<string, string[]> = {};
  // Which delivery methods (Express / Standard) apply at each address, across every item in the cart.
  const methodsByAddress: Record<string, { express: boolean; standard: boolean; standardDays: number }> = {};
  await Promise.all(
    addresses.map(async (a) => {
      const results = await checkProductsDeliverable(products, { lat: a.lat, lng: a.lng });
      const names = products.filter((p) => results.get(p.id)?.message).map((p) => p.name);
      if (names.length > 0) blockedByAddress[a.id] = names;
      // Outside the states we serve (India: Kerala only for now): nothing in the cart can be delivered there.
      if (!stateInServiceArea(tenant?.country_code, (a as { state?: string | null }).state)) blockedByAddress[a.id] = products.map((p) => p.name);
      methodsByAddress[a.id] = combineMethods([...results.values()].map((r) => r.methods));
    })
  );

  // One order per supplier: group the cart so the summary can show each parcel and its delivery fee.
  const storeName = new Map((await getStoreDirectory()).map((st) => [st.id, st.name]));
  const groupMap = new Map<string, { key: string; name: string; subtotal: number }>();
  for (const i of items) {
    const sid = i.product_variants.products.store_id;
    const key = sid ?? "own";
    const g = groupMap.get(key) ?? { key, name: sid ? storeName.get(sid) ?? "Shop" : "FasTrack", subtotal: 0 };
    g.subtotal = Math.round((g.subtotal + i.quantity * i.product_variants.price) * 100) / 100;
    groupMap.set(key, g);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 max-md:pb-44">
      <h1 className="mb-4 text-xl font-semibold max-md:hidden">{t("checkout.title")}</h1>
      <CheckoutForm addresses={addresses} items={items} subtotal={subtotal} blockedByAddress={blockedByAddress} methodsByAddress={methodsByAddress} taxTotal={taxTotal} taxLabel={taxProfile.label} groups={[...groupMap.values()]} deliveryTaxPercent={deliveryTaxRate(tenant?.country_code)} />
    </div>
  );
}

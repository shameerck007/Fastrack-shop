import Link from "@/components/Link";
import CartItemRow from "@/components/CartItemRow";
import { getCartItems, cartSubtotal } from "@/lib/cart";
import { getAddresses } from "@/lib/addresses";
import { CartDeliveryOptions } from "@/components/DeliveryOptionsInfo";
import { checkProductsDeliverable } from "@/lib/delivery-zones";

import { localizedName } from "@/lib/i18n/localized";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/t";
import { getMoney } from "@/lib/tenant-server";

export default async function CartPage() {
  const money = await getMoney();
  const locale = await getServerLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const [items, addresses] = await Promise.all([getCartItems(), getAddresses()]);
  const subtotal = cartSubtotal(items);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-16 text-center">
        <span className="mb-5 flex h-28 w-28 items-center justify-center rounded-full bg-blue-50 text-5xl shadow-inner ring-8 ring-blue-50/60">🛒</span>
        <p className="text-xl font-bold text-neutral-900">{t("cart.empty")}</p>
        <p className="mt-1 max-w-xs text-sm text-neutral-500">Add groceries and daily essentials — we&apos;ll bring them to your door in minutes.</p>
        <Link
          href="/"
          className="mt-6 rounded-full bg-blue-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition active:scale-95"
        >
          {t("cart.start_shopping")}
        </Link>
      </div>
    );
  }

  // A cart item can pass the deliverability check when it's added (against
  // whatever the shopper's browsing location was at that moment) and still
  // turn out undeliverable at checkout time, if that location doesn't match
  // any of their saved addresses. Rather than let that surface for the
  // first time as a checkout error, flag it here: an item is only a real
  // problem if it can't reach *any* saved address, not just the default one
  // — checkout already lets the shopper pick a different address for that.
  const pinnedAddresses = addresses.filter((a) => a.lat != null && a.lng != null);
  const undeliverableProductIds = new Set<string>();
  if (pinnedAddresses.length > 0) {
    const products = items.map((i) => ({
      id: i.product_variants.products.id,
      store_id: i.product_variants.products.store_id,
      name: localizedName(i.product_variants.products, locale),
    }));
    const perAddressResults = await Promise.all(
      pinnedAddresses.map((a) => checkProductsDeliverable(products, { lat: a.lat as number, lng: a.lng as number }))
    );
    for (const p of products) {
      const deliverableToAny = perAddressResults.some((result) => !result.get(p.id)?.message);
      if (!deliverableToAny) undeliverableProductIds.add(p.id);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 max-md:pb-32">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-2 flex items-end justify-between border-b border-neutral-200 pb-2">
            <h1 className="text-2xl font-semibold max-md:hidden">{t("cart.title")}</h1>
            <span className="hidden text-sm text-neutral-500 sm:inline">{t("cart.price_col")}</span>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white px-4">
            {items.map((item) => (
              <CartItemRow
                key={item.id}
                item={item}
                undeliverable={undeliverableProductIds.has(item.product_variants.products.id)}
              />
            ))}
          </div>
          <p className="mt-3 text-end text-lg">
            <span className="text-neutral-500">
              {t("cart.subtotal_items", { count: itemCount, plural: itemCount === 1 ? "" : "s" })}:
            </span>{" "}
            <span className="font-semibold">{money(subtotal)}</span>
          </p>
          <div className="mt-4">
            <CartDeliveryOptions storeIds={items.map((i) => i.product_variants.products.store_id)} />
          </div>
        </div>

        <div className="h-fit lg:sticky lg:top-20 max-md:hidden">
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="mb-1 text-sm">
              <span className="text-neutral-600">
                {t("cart.subtotal_items", { count: itemCount, plural: itemCount === 1 ? "" : "s" })}:
              </span>{" "}
              <span className="font-semibold">{money(subtotal)}</span>
            </p>
            <p className="mb-4 text-xs text-neutral-400">{t("cart.delivery_fee_note")}</p>
            <Link
              href="/checkout"
              className="block rounded-full bg-blue-700 py-2.5 text-center font-medium text-white hover:bg-blue-800"
            >
              {t("cart.proceed_to_checkout")}
            </Link>
          </div>
        </div>
      </div>

      {/* Phones: the checkout button stays pinned to the bottom of the screen, never hidden under the tab bar. */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-100 bg-white px-4 pt-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] md:hidden"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-xs text-neutral-500">{t("cart.subtotal_items", { count: itemCount, plural: itemCount === 1 ? "" : "s" })}</p>
            <p className="text-lg font-extrabold leading-tight text-neutral-900">{money(subtotal)}</p>
          </div>
          <Link
            href="/checkout"
            className="ms-auto flex h-12 flex-1 items-center justify-center rounded-full bg-blue-700 px-6 text-center font-extrabold text-white shadow-lg shadow-blue-700/25 hover:bg-blue-800"
          >
            {t("cart.proceed_to_checkout")}
          </Link>
        </div>
      </div>
    </div>
  );
}

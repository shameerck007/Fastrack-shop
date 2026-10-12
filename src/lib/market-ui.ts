// How the customer storefront looks per market.
//   Saudi Arabia: a marketplace of shops - the "Shops" row, shop names on products, shop pages (and the same calculated delivery times).
//   India: Instamart-style - one catalogue by delivery location, no shop browsing; the seller is still named on the
//   product page (small "Sold by" text, as the E-Commerce Rules expect) and on invoices.

export interface MarketUi {
  /** Shops row on the home page, shop pages and shop links. */
  showShops: boolean;
  /** "Sold by <shop>" on product cards. */
  soldByOnCards: boolean;
  /** Calculated delivery time ("⚡ 20–25 min" / "Delivery by ...") in the header, on product cards, the product page and checkout. */
  deliveryBadges: boolean;
  /** Parcels at checkout are named "Delivery 1, 2..." instead of by shop. */
  genericParcels: boolean;
}

const INSTAMART: MarketUi = { showShops: false, soldByOnCards: false, deliveryBadges: true, genericParcels: true };
const MARKETPLACE: MarketUi = { showShops: true, soldByOnCards: true, deliveryBadges: true, genericParcels: false };

/** `showShopsOverride` is the admin's Shops switch (Business settings > Storefront): true shows shops, false hides them, null follows the market. */
export function marketUi(countryCode: string | null | undefined, showShopsOverride?: boolean | null): MarketUi {
  if (showShopsOverride === true) return MARKETPLACE;
  if (showShopsOverride === false) return INSTAMART;
  return (countryCode ?? "SA").toUpperCase() === "IN" ? INSTAMART : MARKETPLACE;
}

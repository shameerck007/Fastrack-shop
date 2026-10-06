// How the customer storefront looks per market.
//   Saudi Arabia: a marketplace of shops - the "Shops" row, shop names on products, shop pages.
//   India: Instamart-style - one catalogue by delivery location, no shop browsing; the seller is still named on the
//   product page (small "Sold by" text, as the E-Commerce Rules expect) and on invoices.

export interface MarketUi {
  /** Shops row on the home page, shop pages and shop links. */
  showShops: boolean;
  /** "Sold by <shop>" on product cards. */
  soldByOnCards: boolean;
  /** "⚡ Express" / "Delivery by ..." badge on product cards. */
  deliveryBadges: boolean;
  /** Parcels at checkout are named "Delivery 1, 2..." instead of by shop. */
  genericParcels: boolean;
}

const INSTAMART: MarketUi = { showShops: false, soldByOnCards: false, deliveryBadges: true, genericParcels: true };
const MARKETPLACE: MarketUi = { showShops: true, soldByOnCards: true, deliveryBadges: false, genericParcels: false };

export function marketUi(countryCode: string | null | undefined): MarketUi {
  return (countryCode ?? "SA").toUpperCase() === "IN" ? INSTAMART : MARKETPLACE;
}

// On phones these routes drop the global header/footer (Keeta-style) and use
// a slim top bar with a round back button instead. Desktop is unaffected —
// every use of this is a mobile-only (below md) hide.
const FULLSCREEN = ["/products", "/categories", "/cart", "/checkout", "/orders", "/account", "/addresses", "/login", "/register", "/search"];

// Product and category pages draw their own top bar (floating buttons over
// the photo / a title bar with search + cart); the rest use BackBar's.
const OWN_TOP_BAR = ["/products", "/categories", "/search"];

const matches = (pathname: string, prefixes: string[]) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));

export function isFullscreenMobileRoute(pathname: string): boolean {
  return matches(pathname, FULLSCREEN);
}

export function hasOwnMobileTopBar(pathname: string): boolean {
  return matches(pathname, OWN_TOP_BAR);
}

// Pages where the Keeta-style checkout bar floats at the bottom of the screen
// (and takes the place of the bottom tabs). Product pages embed their own,
// and cart/checkout/account/auth screens don't need one.
const NO_CART_BAR = ["/products", "/cart", "/checkout", "/login", "/register", "/account", "/orders"];

export function showsCartBar(pathname: string): boolean {
  return !matches(pathname, NO_CART_BAR);
}

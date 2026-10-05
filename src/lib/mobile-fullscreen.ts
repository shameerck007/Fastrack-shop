// Routes that take over the whole screen on phones (Keeta-style): no global
// header/footer, their own top bar with a round back button. Desktop is
// unaffected — every use of this is a mobile-only (below md) hide.
export function isFullscreenMobileRoute(pathname: string): boolean {
  return pathname.startsWith("/products/") || pathname.startsWith("/categories/");
}

export const CART_CHANGED_EVENT = "fastrack:cart-changed";

export function notifyCartChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CART_CHANGED_EVENT));
  }
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

/** Re-renders the page once, after a burst of cart taps goes quiet. Refreshing after every single tap
 * re-rendered the whole page (and the server) on each one, which overloaded the server on quick taps. */
export function refreshSoon(refresh: () => void, quietMs = 450) {
  if (typeof window === "undefined") return;
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    refresh();
  }, quietMs);
}

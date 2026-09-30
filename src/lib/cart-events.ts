export const CART_CHANGED_EVENT = "fastrack:cart-changed";

export function notifyCartChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CART_CHANGED_EVENT));
  }
}

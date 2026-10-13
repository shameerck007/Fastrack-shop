"use client";

import Breadcrumbs, { type Crumb } from "@/components/Breadcrumbs";
import { useLocale } from "@/components/LocaleProvider";

type T = (key: string) => string;

/** The trail for a route, or null when the page draws its own (products, categories) or does not use one (home, sign-in, search). */
function trailFor(pathname: string, t: T): Crumb[] | null {
  const home: Crumb = { label: t("category.home"), href: "/" };
  const seg = (label: string, href?: string): Crumb => ({ label, href });
  const account = seg(t("account.title"), "/account");

  if (pathname === "/cart") return [home, seg(t("cart.title"))];
  if (pathname === "/checkout") return [home, seg(t("cart.title"), "/cart"), seg(t("checkout.title"))];
  if (pathname === "/orders") return [home, account, seg(t("orders.title"))];
  if (pathname.startsWith("/orders/")) return [home, account, seg(t("orders.title"), "/orders"), seg("Order details")];
  if (pathname === "/account") return [home, seg(t("account.title"))];
  if (pathname === "/account/security") return [home, account, seg("Login and security")];
  if (pathname === "/account/payments") return [home, account, seg("Payment methods")];
  if (pathname === "/account/lists") return [home, account, seg("Your lists")];
  if (pathname === "/addresses") return [home, account, seg(t("addresses.title"))];
  if (pathname === "/deliver") return [home, seg("Deliver with FasTrack")];
  if (pathname === "/sell") return [home, seg("Sell on FasTrack")];
  if (pathname === "/privacy") return [home, seg("Privacy notice")];
  if (pathname === "/terms") return [home, seg("Conditions of use")];
  return null;
}

/**
 * The line of links under the header ("Home / Your account / Login and security"). It replaces the old "Back" bar:
 * it shows where you are and lets you jump up any level. Phones keep their slim title bar with a round back button
 * for the full-screen pages, so this shows from tablet width up there and everywhere on the other pages.
 */
export default function AutoBreadcrumbs({ pathname, desktopOnly }: { pathname: string; desktopOnly: boolean }) {
  const { t } = useLocale();
  const trail = trailFor(pathname, t as unknown as T);
  if (!trail) return null;
  return (
    <div className={desktopOnly ? "hidden md:block" : ""}>
      <div className="mx-auto max-w-6xl px-4 pt-4 md:px-6">
        <Breadcrumbs items={trail} />
      </div>
    </div>
  );
}

"use client";

import PortalNav, { type PortalNavItem } from "@/components/PortalNav";

const NAV: PortalNavItem[] = [
  { href: "/merchant", labelKey: "portal.dashboard", icon: "📊" },
  { href: "/merchant/orders", labelKey: "merchant.orders_nav", icon: "🧾" },
  { href: "/merchant/products", labelKey: "merchant.products_stock", icon: "📦" },
  { href: "/merchant/catalog", label: "Product catalog", icon: "📚" },
  { href: "/merchant/settlements", labelKey: "merchant.settlement_ledger", icon: "📒" },
];

export default function MerchantNav() {
  return <PortalNav items={NAV} rootHref="/merchant" />;
}

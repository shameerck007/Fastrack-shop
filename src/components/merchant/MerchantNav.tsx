"use client";

import PortalNav, { type PortalNavItem } from "@/components/PortalNav";

const NAV: PortalNavItem[] = [
  { href: "/merchant", labelKey: "portal.dashboard", icon: "dashboard" },
  { href: "/merchant/orders", labelKey: "merchant.orders_nav", icon: "orders" },
  { href: "/merchant/products", labelKey: "merchant.products_stock", icon: "box" },
  { href: "/merchant/catalog", label: "Product catalog", icon: "catalog" },
  { href: "/merchant/returns", label: "Returns", icon: "returns" },
  { href: "/merchant/integrations", label: "Import & API", icon: "api" },
  { href: "/merchant/settlements", labelKey: "merchant.settlement_ledger", icon: "ledger" },
];

export default function MerchantNav() {
  return <PortalNav items={NAV} rootHref="/merchant" portal="merchant" tabs={["/merchant", "/merchant/orders", "/merchant/products", "/merchant/catalog"]} />;
}

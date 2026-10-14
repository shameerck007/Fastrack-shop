"use client";

import PortalNav, { type PortalNavItem } from "@/components/PortalNav";

const NAV: PortalNavItem[] = [
  { href: "/warehouse", labelKey: "portal.dashboard", icon: "dashboard" },
  { href: "/warehouse/orders", labelKey: "warehouse.orders_nav", icon: "orders" },
  { href: "/warehouse/stock", labelKey: "warehouse.stock_nav", icon: "box" },
  { href: "/warehouse/returns", label: "Returns", icon: "returns" },
  { href: "/warehouse/transfers", label: "Stock transfers", icon: "transfers" },
];

export default function WarehouseNav() {
  return <PortalNav items={NAV} rootHref="/warehouse" />;
}

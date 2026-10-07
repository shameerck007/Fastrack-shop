"use client";

import PortalNav, { type PortalNavItem } from "@/components/PortalNav";

const NAV: PortalNavItem[] = [
  { href: "/admin", labelKey: "portal.dashboard", icon: "📊", section: "Overview" },
  { href: "/admin/store", labelKey: "admin.fastrack_stores", icon: "🏬", section: "Catalog & stores" },
  { href: "/admin/products", labelKey: "admin.products", icon: "📦", section: "Catalog & stores" },
  { href: "/admin/categories", labelKey: "admin.categories", icon: "🗂️", section: "Catalog & stores" },
  { href: "/admin/merchants", labelKey: "admin.merchants", icon: "🏪", section: "Catalog & stores" },
  { href: "/admin/orders", labelKey: "admin.orders", icon: "🧾", section: "Operations" },
  { href: "/admin/riders", labelKey: "admin.riders", icon: "🛵", section: "Operations" },
  { href: "/admin/settlements", labelKey: "admin.settlement_ledger", icon: "📒", section: "Finance" },
  { href: "/admin/rider-settlements", labelKey: "admin.rider_settlements", icon: "🛵", section: "Finance" },
  { href: "/admin/collections", labelKey: "admin.collections", icon: "💵", section: "Finance" },
  { href: "/admin/zones", labelKey: "admin.delivery_zones", icon: "📍", section: "Setup" },
  { href: "/admin/settings", labelKey: "admin.business_settings", icon: "⚙️", section: "Setup" },
];

export default function AdminNav() {
  return <PortalNav items={NAV} rootHref="/admin" />;
}

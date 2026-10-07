"use client";

import PortalNav, { type PortalNavItem } from "@/components/PortalNav";

const NAV: PortalNavItem[] = [
  { href: "/admin", labelKey: "portal.dashboard", icon: "📊" },
  { href: "/admin/store", labelKey: "admin.fastrack_stores", icon: "🏬" },
  { href: "/admin/products", labelKey: "admin.products", icon: "📦" },
  { href: "/admin/categories", labelKey: "admin.categories", icon: "🗂️" },
  { href: "/admin/orders", labelKey: "admin.orders", icon: "🧾" },
  { href: "/admin/merchants", labelKey: "admin.merchants", icon: "🏪" },
  { href: "/admin/riders", labelKey: "admin.riders", icon: "🛵" },
  { href: "/admin/settlements", labelKey: "admin.settlement_ledger", icon: "📒" },
  { href: "/admin/rider-settlements", labelKey: "admin.rider_settlements", icon: "🛵" },
  { href: "/admin/collections", labelKey: "admin.collections", icon: "💵" },
  { href: "/admin/zones", labelKey: "admin.delivery_zones", icon: "📍" },
  { href: "/admin/settings", labelKey: "admin.business_settings", icon: "⚙️" },
];

export default function AdminNav() {
  return <PortalNav items={NAV} rootHref="/admin" />;
}

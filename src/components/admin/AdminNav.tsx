"use client";

import PortalNav, { type PortalNavItem } from "@/components/PortalNav";

const NAV: PortalNavItem[] = [
  { href: "/admin", labelKey: "portal.dashboard", icon: "dashboard", section: "Overview" },
  { href: "/admin/catalog", label: "Product catalog", icon: "catalog", section: "Catalog & stores" },
  { href: "/admin/products", label: "Listings & stock", icon: "box", section: "Catalog & stores" },
  { href: "/admin/categories", labelKey: "admin.categories", icon: "categories", section: "Catalog & stores" },
  { href: "/admin/store", labelKey: "admin.fastrack_stores", icon: "stores", section: "Catalog & stores" },
  { href: "/admin/merchants", labelKey: "admin.merchants", icon: "merchants", section: "Catalog & stores" },
  { href: "/admin/orders", labelKey: "admin.orders", icon: "orders", section: "Operations" },
  { href: "/admin/users", label: "Users", icon: "users", section: "Operations" },
  { href: "/admin/returns", label: "Returns", icon: "returns", section: "Operations" },
  { href: "/admin/transfers", label: "Stock transfers", icon: "transfers", section: "Operations" },
  { href: "/admin/offers", label: "Offers & coupons", icon: "offers", section: "Marketing" },
  { href: "/admin/banners", label: "Home banners", icon: "banners", section: "Marketing" },
  { href: "/admin/delivery-fees", label: "Delivery fees", icon: "delivery", section: "Marketing" },
  { href: "/admin/commission", label: "Commission rates", icon: "commission", section: "Finance" },
  { href: "/admin/settlements", labelKey: "admin.settlement_ledger", icon: "ledger", section: "Finance" },
  { href: "/admin/earnings", label: "Platform earnings", icon: "earnings", section: "Finance" },
  { href: "/admin/rider-settlements", labelKey: "admin.rider_settlements", icon: "wallet", section: "Finance" },
  { href: "/admin/collections", labelKey: "admin.collections", icon: "cash", section: "Finance" },
  { href: "/admin/zones", labelKey: "admin.delivery_zones", icon: "zones", section: "Setup" },
  { href: "/admin/errors", label: "System errors", icon: "errors", section: "Setup" },
  { href: "/admin/settings", labelKey: "admin.business_settings", icon: "settings", section: "Setup" },
];

export default function AdminNav() {
  return <PortalNav items={NAV} rootHref="/admin" portal="admin" tabs={["/admin", "/admin/orders", "/admin/products", "/admin/returns"]} />;
}

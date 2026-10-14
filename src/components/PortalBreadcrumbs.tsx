"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Breadcrumbs, { type Crumb } from "@/components/Breadcrumbs";
import { findCountry } from "@/lib/countries";

type Portal = "admin" | "merchant" | "rider" | "warehouse" | "platform";

const ROOT: Record<Portal, { label: string; href: string }> = {
  admin: { label: "Admin", href: "/admin" },
  merchant: { label: "Supplier", href: "/merchant" },
  rider: { label: "Rider", href: "/rider" },
  warehouse: { label: "Warehouse", href: "/warehouse" },
  platform: { label: "Platform", href: "/platform" },
};

/** Section names, by full path. Anything not listed is named from its last segment ("rider-settlements" becomes "Rider settlements"). */
const NAMES: Record<string, string> = {
  "/admin/catalog": "Product catalog",
  "/admin/products": "Listings & stock",
  "/admin/categories": "Categories",
  "/admin/store": "FasTrack stores",
  "/admin/merchants": "Merchants",
  "/admin/orders": "Orders",
  "/admin/users": "Users",
  "/admin/returns": "Returns",
  "/admin/transfers": "Stock transfers",
  "/admin/offers": "Offers & coupons",
  "/admin/banners": "Home banners",
  "/admin/delivery-fees": "Delivery fees",
  "/admin/commission": "Commission rates",
  "/admin/settlements": "Supplier ledger",
  "/admin/earnings": "Platform earnings",
  "/admin/rider-settlements": "Rider settlements",
  "/admin/collections": "Collections",
  "/admin/zones": "Delivery zones",
  "/admin/zones/coverage": "Coverage",
  "/admin/errors": "System errors",
  "/admin/settings": "Business settings",
  "/admin/riders": "Riders",
  "/admin/customers": "Customers",
  "/merchant/orders": "Orders",
  "/merchant/products": "Products & stock",
  "/merchant/catalog": "Product catalog",
  "/merchant/returns": "Returns",
  "/merchant/integrations": "Import & API",
  "/merchant/settlements": "Supplier ledger",
  "/rider/orders": "Orders",
  "/rider/earnings": "Earnings",
  "/rider/history": "Trips",
  "/rider/returns": "Returns",
  "/rider/routes": "Routes",
  "/warehouse/orders": "Orders",
  "/warehouse/stock": "Stock",
  "/warehouse/returns": "Returns",
  "/warehouse/transfers": "Stock transfers",
  "/platform/markets": "Markets",
};

const isDynamic = (seg: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(seg) || /^\d+$/.test(seg) || /^[A-Z]{2}$/.test(seg);
const humanize = (seg: string) => seg.replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());

interface Ctx {
  setLabel: (path: string, label: string | null) => void;
}
const CrumbCtx = createContext<Ctx>({ setLabel: () => {} });

/** A page with an id in its address calls this to name its last crumb (the supplier's name, the order number). */
export function CrumbLabel({ label }: { label: string }) {
  const { setLabel } = useContext(CrumbCtx);
  const pathname = usePathname();
  useEffect(() => {
    setLabel(pathname, label);
    return () => setLabel(pathname, null);
  }, [pathname, label, setLabel]);
  return null;
}

/**
 * The trail shown above every portal page ("Admin / Supplier ledger / ABC Limited"). The same pattern as the shop, so
 * every role navigates the same way: no Back buttons, just the path with each level a link. Not shown on the portal's
 * home page, where it would only say the name of the portal.
 */
export default function PortalBreadcrumbs({ portal, children }: { portal: Portal; children: React.ReactNode }) {
  const pathname = usePathname();
  const [labels, setLabels] = useState<Record<string, string>>({});
  const ctx = useMemo<Ctx>(
    () => ({
      setLabel: (path, label) =>
        setLabels((cur) => {
          if (label === null) {
            if (!(path in cur)) return cur;
            const { [path]: _drop, ...rest } = cur;
            void _drop;
            return rest;
          }
          return cur[path] === label ? cur : { ...cur, [path]: label };
        }),
    }),
    [],
  );

  const root = ROOT[portal];
  const segments = pathname.split("/").filter(Boolean);
  const trail: Crumb[] = [];
  if (segments[0] === root.href.slice(1) && segments.length > 1) {
    trail.push({ label: root.label, href: root.href });
    let path = root.href;
    for (let i = 1; i < segments.length; i++) {
      path += `/${segments[i]}`;
      const last = i === segments.length - 1;
      const country = portal === "platform" && i === 1 && /^[a-z]{2}$/.test(segments[i]) ? findCountry(segments[i].toUpperCase()).name : null;
      const label = labels[path] ?? NAMES[path] ?? country ?? (isDynamic(segments[i]) ? "Details" : humanize(segments[i]));
      trail.push({ label, href: last ? undefined : path });
    }
  }

  return (
    <CrumbCtx.Provider value={ctx}>
      {trail.length > 1 && <Breadcrumbs items={trail} />}
      {children}
    </CrumbCtx.Provider>
  );
}

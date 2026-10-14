"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "@/components/Link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";
import NavIcon from "@/components/ui/NavIcon";

export interface PortalNavItem {
  href: string;
  /** Translated through the dictionary... */
  labelKey?: string;
  /** ...or shown as-is (for areas that are English only). */
  label?: string;
  /** A line-icon name from ui/NavIcon (an emoji in an older menu still works). */
  icon: string;
  /** Optional section heading: items with the same heading are grouped, and the group can be folded. */
  section?: string;
}

interface Group {
  section: string | null;
  items: PortalNavItem[];
}

// Which groups the person has folded or opened is remembered on this device (the group holding the current page is open by default).
const KEY = "ft_nav_groups";
const subscribe = (cb: () => void) => {
  window.addEventListener("ft-nav-changed", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("ft-nav-changed", cb);
    window.removeEventListener("storage", cb);
  };
};
const readRaw = () => {
  try {
    return localStorage.getItem(KEY) ?? "{}";
  } catch {
    return "{}";
  }
};

/**
 * The portal menu. On desktop a slim side menu with folding groups and small line icons; on a phone one "Menu" bar showing the current
 * page, which opens the full menu as a panel sliding in from the side. `rootHref` is only active on an exact match (otherwise it
 * would light up for every sub-page).
 */
export default function PortalNav({ items, rootHref }: { items: PortalNavItem[]; rootHref: string }) {
  const pathname = usePathname();
  const { t } = useLocale();
  const [drawer, setDrawer] = useState(false);
  const stored = useSyncExternalStore(subscribe, readRaw, () => "{}");
  const folded = useMemo(() => {
    try {
      return JSON.parse(stored) as Record<string, boolean>;
    } catch {
      return {};
    }
  }, [stored]);

  const isActive = (item: PortalNavItem) => (item.href === rootHref ? pathname === item.href : pathname.startsWith(item.href));
  const labelOf = (item: PortalNavItem) => item.label ?? t(item.labelKey ?? "");

  const groups = useMemo<Group[]>(() => {
    const out: Group[] = [];
    for (const item of items) {
      const last = out[out.length - 1];
      if (last && last.section === (item.section ?? null)) last.items.push(item);
      else out.push({ section: item.section ?? null, items: [item] });
    }
    return out;
  }, [items]);
  // A heading over a single link is just noise: show that link on its own.
  const flat = (g: Group) => g.items.length === 1;
  const current = items.filter(isActive).sort((a, b) => b.href.length - a.href.length)[0];

  // The panel closes when you go somewhere, and on Escape; the page behind it does not scroll while it is open.
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [drawer]);

  function toggle(section: string, open: boolean) {
    try {
      // Read what is saved right now (not the value this screen drew with), so quick successive clicks never overwrite each other.
      const now = JSON.parse(readRaw()) as Record<string, boolean>;
      localStorage.setItem(KEY, JSON.stringify({ ...now, [section]: !open }));
      window.dispatchEvent(new Event("ft-nav-changed"));
    } catch {
      /* private mode: it simply is not remembered */
    }
  }

  const row = (item: PortalNavItem, active: boolean) => (
    <Link
      key={item.href}
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`relative flex h-10 items-center gap-3 rounded-xl px-3 text-[13.5px] font-semibold transition md:h-9 ${
        active ? "bg-brand-50 text-brand-800" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
      }`}
    >
      {active && <span aria-hidden className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-brand-600" />}
      <span className={active ? "text-brand-700" : "text-neutral-500"}>
        <NavIcon name={item.icon} />
      </span>
      <span className="truncate">{labelOf(item)}</span>
    </Link>
  );

  const list = (
    <div className="flex flex-col gap-0.5">
      {groups.map((g, gi) => {
        if (!g.section || flat(g)) return <div key={gi}>{g.items.map((item) => row(item, item === current))}</div>;
        const hasActive = g.items.some((i) => i === current);
        const open = folded[g.section] ?? hasActive;
        return (
          <div key={g.section} className="mt-1.5 first:mt-0">
            <button
              type="button"
              onClick={() => toggle(g.section as string, open)}
              aria-expanded={open}
              className="flex h-8 w-full items-center justify-between rounded-lg px-3 text-[11px] font-bold uppercase tracking-wider text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
            >
              <span className="flex items-center gap-2">
                {g.section}
                {!open && hasActive && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-600" />}
              </span>
              <span aria-hidden className={`transition-transform ${open ? "rotate-90" : "rtl:-scale-x-100"}`}>
                <NavIcon name="chevron" className="h-3.5 w-3.5" />
              </span>
            </button>
            {open && <div className="mt-0.5 flex flex-col gap-0.5">{g.items.map((item) => row(item, item === current))}</div>}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Phones: one bar with the current page, opening the full menu from the side. */}
      <button
        type="button"
        onClick={() => setDrawer(true)}
        aria-haspopup="dialog"
        className="flex h-11 w-full items-center gap-3 rounded-2xl bg-white px-3.5 text-start text-sm font-bold text-neutral-900 shadow-sm ring-1 ring-neutral-200 md:hidden"
      >
        <span className="text-neutral-600">
          <NavIcon name="menu" className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1 truncate">{current ? labelOf(current) : "Menu"}</span>
        <span className="text-neutral-400 rtl:-scale-x-100">
          <NavIcon name="chevron" className="h-4 w-4" />
        </span>
      </button>

      {drawer && (
        <div className="fixed inset-0 z-[70] md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-neutral-900/40 backdrop-blur-[2px]" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 start-0 flex w-[19rem] max-w-[86vw] flex-col bg-white shadow-2xl">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-100 px-4">
              <span className="text-sm font-extrabold tracking-tight text-neutral-900">Menu</span>
              <button type="button" onClick={() => setDrawer(false)} aria-label="Close menu" className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100">
                <NavIcon name="close" className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={(e) => (e.target as HTMLElement).closest("a") && setDrawer(false)}>
              {list}
            </nav>
          </div>
        </div>
      )}

      {/* Computers: the side menu. */}
      <nav className="hidden md:block" aria-label="Menu">
        {list}
      </nav>
    </>
  );
}

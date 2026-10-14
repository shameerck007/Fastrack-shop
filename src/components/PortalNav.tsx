"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "@/components/Link";
import { usePathname, useRouter } from "next/navigation";
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

// What the person folded or opened, and whether the menu is shrunk to icons, is remembered on this device.
const GROUPS_KEY = "ft_nav_groups";
const RAIL_KEY = "ft_nav_rail";
const subscribe = (cb: () => void) => {
  window.addEventListener("ft-nav-changed", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("ft-nav-changed", cb);
    window.removeEventListener("storage", cb);
  };
};
const read = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
    window.dispatchEvent(new Event("ft-nav-changed"));
  } catch {
    /* private mode: it simply is not remembered */
  }
};

const COUNT_EVERY_MS = 60_000;

function Badge({ n, className = "" }: { n: number; className?: string }) {
  if (!n) return null;
  return (
    <span className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-bold leading-none text-white ${className}`} aria-label={`${n} waiting`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

/**
 * The portal menu (admin, supplier, warehouse).
 *  - Computers: a side menu with folding groups and small line icons; a button shrinks it to an icon strip.
 *  - Phones: a bar of the main pages at the bottom, with "More" opening the full menu as a panel from the side.
 *  - Small red numbers show what is waiting ("Orders 9"), refreshed about once a minute.
 *  - Search the menu (Ctrl+K, or the search button) to jump to any page by typing its name.
 * `rootHref` is only active on an exact match (otherwise it would light up for every sub-page). `tabs` are the hrefs of the main
 * pages shown in the phone bar. `portal` turns the numbers on.
 */
export default function PortalNav({ items, rootHref, portal, tabs = [] }: { items: PortalNavItem[]; rootHref: string; portal?: "admin" | "merchant" | "warehouse"; tabs?: string[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const input = useRef<HTMLInputElement>(null);

  const storedGroups = useSyncExternalStore(subscribe, () => read(GROUPS_KEY, "{}"), () => "{}");
  const rail = useSyncExternalStore(subscribe, () => read(RAIL_KEY, "0") === "1", () => false);
  const folded = useMemo(() => {
    try {
      return JSON.parse(storedGroups) as Record<string, boolean>;
    } catch {
      return {};
    }
  }, [storedGroups]);

  const isActive = (item: PortalNavItem) => (item.href === rootHref ? pathname === item.href : pathname.startsWith(item.href));
  const labelOf = (item: PortalNavItem) => item.label ?? t(item.labelKey ?? "");
  const current = items.filter(isActive).sort((a, b) => b.href.length - a.href.length)[0];

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

  // Numbers: fetched when the menu appears, once a minute, and when the person comes back to the tab.
  useEffect(() => {
    if (!portal) return;
    let live = true;
    const load = () => {
      if (document.visibilityState === "hidden") return;
      fetch(`/api/portal-counts?portal=${portal}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((c: Record<string, number> | null) => live && c && setCounts(c))
        .catch(() => {});
    };
    load();
    const id = setInterval(load, COUNT_EVERY_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      live = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", load);
    };
  }, [portal, pathname]);

  // The panel and the search close on Escape; the page behind them does not scroll while one is open.
  useEffect(() => {
    if (!drawer && !palette) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPalette(false);
        setDrawer(false);
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [drawer, palette]);

  function openPalette() {
    setQuery("");
    setCursor(0);
    setPalette(true);
    setTimeout(() => input.current?.focus(), 30);
  }

  // Ctrl+K (or Cmd+K) opens the search from anywhere in the portal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuery("");
        setCursor(0);
        setPalette(true);
        setTimeout(() => input.current?.focus(), 30);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => `${i.label ?? t(i.labelKey ?? "")} ${i.section ?? ""}`.toLowerCase().includes(q));
  }, [query, items, t]);

  function go(item: PortalNavItem | undefined) {
    if (!item) return;
    setPalette(false);
    setDrawer(false);
    router.push(item.href);
  }

  function toggle(section: string, open: boolean) {
    // Read what is saved right now (not the value this screen drew with), so quick successive clicks never overwrite each other.
    let now: Record<string, boolean> = {};
    try {
      now = JSON.parse(read(GROUPS_KEY, "{}")) as Record<string, boolean>;
    } catch {
      /* start fresh */
    }
    write(GROUPS_KEY, JSON.stringify({ ...now, [section]: !open }));
  }

  const row = (item: PortalNavItem, active: boolean, compact: boolean) => {
    const n = counts[item.href] ?? 0;
    return (
      <Link
        key={item.href}
        href={item.href}
        title={compact ? labelOf(item) : undefined}
        aria-current={active ? "page" : undefined}
        className={`group relative flex items-center rounded-xl text-[14px] font-semibold transition ${compact ? "h-11 w-11 justify-center" : "h-10 gap-3 px-3"} ${
          active ? "bg-brand-50 text-brand-800 shadow-[inset_0_0_0_1px_rgba(0,112,208,0.14)]" : "text-neutral-800 hover:bg-neutral-100 hover:text-neutral-950"
        }`}
      >
        {active && !compact && <span aria-hidden className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-brand-600" />}
        <span className={active ? "text-brand-700" : "text-neutral-700 group-hover:text-neutral-900"}>
          <NavIcon name={item.icon} className={compact ? "h-[22px] w-[22px]" : "h-5 w-5"} />
        </span>
        {!compact && <span className="min-w-0 flex-1 truncate">{labelOf(item)}</span>}
        {compact ? n > 0 && <span aria-hidden className="absolute end-1 top-1 h-2.5 w-2.5 rounded-full bg-rose-600 ring-2 ring-white" /> : <Badge n={n} />}
      </Link>
    );
  };

  const list = (compact: boolean) => (
    <div className={`flex flex-col gap-0.5 ${compact ? "items-center" : ""}`}>
      {groups.map((g, gi) => {
        if (!g.section || flat(g)) {
          return (
            <div key={gi} className={compact ? "flex flex-col items-center gap-0.5" : ""}>
              {g.items.map((item) => row(item, item === current, compact))}
            </div>
          );
        }
        if (compact) {
          return (
            <div key={g.section} className="mt-1.5 flex flex-col items-center gap-0.5 border-t border-neutral-200 pt-1.5">
              {g.items.map((item) => row(item, item === current, true))}
            </div>
          );
        }
        const hasActive = g.items.some((i) => i === current);
        const open = folded[g.section] ?? hasActive;
        const waiting = g.items.reduce((n, i) => n + (counts[i.href] ?? 0), 0);
        return (
          <div key={g.section} className="mt-1.5 first:mt-0">
            <button
              type="button"
              onClick={() => toggle(g.section as string, open)}
              aria-expanded={open}
              className="flex h-8 w-full items-center justify-between rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-wider text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
            >
              <span className="flex items-center gap-2">
                {g.section}
                {!open && (hasActive || waiting > 0) && <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${waiting > 0 ? "bg-rose-600" : "bg-brand-600"}`} />}
              </span>
              <span aria-hidden className={`transition-transform ${open ? "rotate-90" : "rtl:-scale-x-100"}`}>
                <NavIcon name="chevron" className="h-3.5 w-3.5" />
              </span>
            </button>
            {open && <div className="mt-0.5 flex flex-col gap-0.5">{g.items.map((item) => row(item, item === current, false))}</div>}
          </div>
        );
      })}
    </div>
  );

  const searchButton = (
    <button type="button" onClick={openPalette} className="flex h-9 w-full items-center gap-2.5 rounded-xl bg-neutral-100 px-3 text-start text-[13px] text-neutral-500 transition hover:bg-neutral-200/70">
      <NavIcon name="search" className="h-4 w-4" />
      <span className="flex-1">Search menu</span>
      <kbd className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold text-neutral-500 ring-1 ring-neutral-200">Ctrl K</kbd>
    </button>
  );

  const tabItems = tabs.map((h) => items.find((i) => i.href === h)).filter((i): i is PortalNavItem => !!i);
  const moreWaiting = items.filter((i) => !tabs.includes(i.href)).reduce((n, i) => n + (counts[i.href] ?? 0), 0);

  return (
    <>
      {/* Computers: the side menu, full or shrunk to icons. */}
      <nav className={`hidden transition-[width] md:block ${rail ? "w-12" : "w-56"}`} aria-label="Menu">
        {rail ? (
          <div className="flex flex-col items-center gap-1">
            <button type="button" onClick={openPalette} aria-label="Search menu" title="Search menu (Ctrl K)" className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500 hover:bg-neutral-200/70">
              <NavIcon name="search" />
            </button>
            {list(true)}
          </div>
        ) : (
          <>
            <div className="mb-2">{searchButton}</div>
            {list(false)}
          </>
        )}
        <button
          type="button"
          onClick={() => write(RAIL_KEY, rail ? "0" : "1")}
          title={rail ? "Show the full menu" : "Shrink the menu to icons"}
          aria-label={rail ? "Show the full menu" : "Shrink the menu to icons"}
          className={`mt-3 flex h-9 items-center gap-2.5 rounded-xl text-[12px] font-semibold text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 ${rail ? "w-10 justify-center" : "w-full px-3"}`}
        >
          <span className={rail ? "" : "rotate-180 rtl:rotate-0"}>
            <NavIcon name="chevrons" className="h-4 w-4" />
          </span>
          {!rail && "Shrink menu"}
        </button>
      </nav>

      {/* Phones: the main pages in a bar at the bottom; "More" opens everything. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-neutral-100 bg-white shadow-[0_-8px_24px_rgba(0,0,0,0.06)] md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Main pages"
      >
        {tabItems.map((item) => {
          const active = item === current;
          const n = counts[item.href] ?? 0;
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`relative flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold ${active ? "text-brand-700" : "text-neutral-600"}`}>
              <span className="relative">
                <NavIcon name={item.icon} className="h-[22px] w-[22px]" />
                {n > 0 && <Badge n={n} className="absolute -end-3 -top-2 !h-4 !min-w-[1rem] !px-1 !text-[10px]" />}
              </span>
              <span className="max-w-full truncate px-1">{labelOf(item)}</span>
              {active && <span aria-hidden className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-brand-600" />}
            </Link>
          );
        })}
        <button type="button" onClick={() => setDrawer(true)} aria-haspopup="dialog" className="relative flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold text-neutral-500">
          <span className="relative">
            <NavIcon name="menu" className="h-[22px] w-[22px]" />
            {moreWaiting > 0 && <span aria-hidden className="absolute -end-1 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-600 ring-2 ring-white" />}
          </span>
          More
        </button>
      </nav>

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
            <div className="shrink-0 px-3 pt-3">{searchButton}</div>
            <nav className="flex-1 overflow-y-auto px-3 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={(e) => (e.target as HTMLElement).closest("a") && setDrawer(false)}>
              {list(false)}
            </nav>
          </div>
        </div>
      )}

      {palette && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search the menu">
          <button type="button" aria-label="Close search" className="absolute inset-0 bg-neutral-900/40 backdrop-blur-[2px]" onClick={() => setPalette(false)} />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-neutral-200">
            <div className="flex items-center gap-3 border-b border-neutral-100 px-4">
              <span className="text-neutral-400">
                <NavIcon name="search" className="h-5 w-5" />
              </span>
              <input
                ref={input}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCursor(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setCursor((c) => Math.min(results.length - 1, c + 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setCursor((c) => Math.max(0, c - 1));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    go(results[cursor]);
                  }
                }}
                placeholder="Go to a page…"
                aria-label="Search the menu"
                className="h-12 flex-1 bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
              />
              <kbd className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold text-neutral-500">Esc</kbd>
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
              {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-neutral-500">No page matches &ldquo;{query}&rdquo;.</li>}
              {results.map((item, i) => (
                <li key={item.href} role="option" aria-selected={i === cursor}>
                  <button
                    type="button"
                    onClick={() => go(item)}
                    onMouseMove={() => setCursor(i)}
                    className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-start text-sm font-semibold ${i === cursor ? "bg-brand-50 text-brand-800" : "text-neutral-700"}`}
                  >
                    <NavIcon name={item.icon} />
                    <span className="flex-1 truncate">{labelOf(item)}</span>
                    {item.section && <span className="text-[11px] font-medium text-neutral-400">{item.section}</span>}
                    <Badge n={counts[item.href] ?? 0} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

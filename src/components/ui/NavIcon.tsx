/**
 * Line icons for the portal menus, drawn in the current text colour so they follow the theme (the menus used colourful emoji before).
 * Pass one of the names below; anything else (an emoji in an older menu) is shown as plain text.
 */
const PATHS: Record<string, string> = {
  dashboard: "M4 13h6V4H4v9z M4 20h6v-5H4v5z M14 20h6v-9h-6v9z M14 4v5h6V4h-6z",
  catalog: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z M5 17a3 3 0 0 1 3-3h11",
  box: "M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z M4 7.5l8 4.5 8-4.5 M12 12v9",
  categories: "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z",
  stores: "M4 21V8l8-5 8 5v13 M9 21v-6h6v6 M8 11h.01 M12 11h.01 M16 11h.01",
  merchants: "M4 9l1.5-5h13L20 9 M4 9v11h16V9 M4 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 M16 9a3 3 0 0 0 4 0 M9 20v-5h6v5",
  orders: "M6 3h12v18l-3-2-3 2-3-2-3 2V3z M9 8h6 M9 12h6",
  users: "M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19 M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7 M20 19v-1.5a3.5 3.5 0 0 0-2.5-3.3 M15 4.2a3.5 3.5 0 0 1 0 6.6",
  returns: "M9 14l-5-5 5-5 M4 9h11a5 5 0 0 1 0 10h-3",
  transfers: "M4 8h14 M15 5l3 3-3 3 M20 16H6 M9 13l-3 3 3 3",
  offers: "M3 12V4h8l10 10-8 8L3 12z M7.5 8h.01",
  banners: "M4 5h16v14H4z M4 15l4-4 4 4 3-3 5 5 M9 9.5h.01",
  delivery: "M3 6h11v9H3z M14 9h4l3 3v3h-7 M5.5 18a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0 M15.5 18a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0",
  commission: "M19 5L5 19 M7.5 9a1.5 1.5 0 1 0 0-.01 M16.5 18a1.5 1.5 0 1 0 0-.01",
  ledger: "M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4z M9 4v16 M12 9h4",
  earnings: "M4 20V4 M4 20h16 M8 16v-4 M12 16V8 M16 16v-6",
  wallet: "M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4V7z M4 7V6a2 2 0 0 1 2-2h10 M16 13.5h.01",
  cash: "M3 7h18v10H3z M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5 M6.5 10v.01 M17.5 14v.01",
  zones: "M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5",
  errors: "M9 9h6v6a3 3 0 0 1-6 0V9z M10 6.5a2 2 0 0 1 4 0V9h-4V6.5z M5 12h4 M15 12h4 M6 8l3 2 M18 8l-3 2 M6 19l3-2 M18 19l-3-2",
  settings: "M4 6h10 M18 6h2 M4 12h4 M12 12h8 M4 18h12 M20 18h0 M16 4v4 M10 10v4 M18 16v4",
  api: "M9 3v5 M15 3v5 M7 8h10v4a5 5 0 0 1-10 0V8z M12 17v4",
  menu: "M4 7h16 M4 12h16 M4 17h16",
  chevron: "M9 6l6 6-6 6",
  close: "M6 6l12 12 M18 6L6 18",
};

export default function NavIcon({ name, className = "h-[18px] w-[18px]" }: { name: string; className?: string }) {
  const d = PATHS[name];
  if (!d) return <span aria-hidden>{name}</span>;
  return (
    <svg viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}

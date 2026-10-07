"use client";

import { useEffect, useRef, useState } from "react";

export interface FilterGroup {
  value: string;
  label: string;
}

/**
 * Search box (plus optional filter chips) for server-rendered lists. Rows opt in with `data-filter` (extra searchable
 * text, the row's own text is always searched too) and optionally `data-group` (the chip value they belong to).
 * Matching rows stay, the rest are hidden, so any list gets a search without turning into a client component.
 */
export default function ListFilter({
  target,
  placeholder = "Search…",
  groups,
  allLabel = "All",
  noMatchText = "Nothing matches your search.",
}: {
  /** id of the element that contains the rows. */
  target: string;
  placeholder?: string;
  groups?: FilterGroup[];
  allLabel?: string;
  noMatchText?: string;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [shown, setShown] = useState<{ visible: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const root = document.getElementById(target);
    if (!root) return;
    const q = query.trim().toLowerCase();
    const rows = Array.from(root.querySelectorAll<HTMLElement>("[data-filter]"));
    let visible = 0;
    for (const row of rows) {
      const text = `${row.dataset.filter ?? ""} ${row.textContent ?? ""}`.toLowerCase();
      const ok = (!q || text.includes(q)) && (group === "all" || row.dataset.group === group);
      row.style.display = ok ? "" : "none";
      if (ok) visible++;
    }
    setShown({ visible, total: rows.length });
  }, [query, group, target]);

  const active = query.trim() !== "" || group !== "all";

  return (
    <div className="mb-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">🔍</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-full border border-neutral-300 bg-white py-2 pe-4 ps-9 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        {shown && active && (
          <span className="text-xs text-neutral-500">
            {shown.visible} of {shown.total}
          </span>
        )}
      </div>

      {groups && groups.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden">
          {[{ value: "all", label: allLabel }, ...groups].map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => setGroup(g.value)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                group === g.value ? "bg-blue-600 text-white shadow" : "bg-white text-neutral-600 ring-1 ring-neutral-200 hover:bg-blue-50"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}

      {shown && active && shown.visible === 0 && (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-4 text-center text-sm text-neutral-500">{noMatchText}</p>
      )}
    </div>
  );
}

"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
  /** Small grey text next to the label (a code, a country, a count). */
  hint?: string;
  /** Options with the same group are listed under one heading. */
  group?: string;
  disabled?: boolean;
}

const SEARCH_FROM = 7; // lists shorter than this are short enough to read without searching

/**
 * The app's dropdown: a tidy button that opens a list with a search box (long lists), keyboard support and, on phones,
 * a bottom sheet. Works inside a normal <form> through `name` (a hidden input) and inside modals.
 */
export default function SearchSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  name,
  required,
  disabled,
  clearable,
  searchable,
  searchPlaceholder = "Search…",
  emptyText = "Nothing matches",
  className = "",
  size = "md",
  variant = "field",
  id,
  ariaLabel,
}: {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  /** Shows a "clear" choice (selects the empty value). */
  clearable?: boolean;
  /** Force the search box on or off; by default it shows for longer lists. */
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  size?: "sm" | "md";
  /** "pill" is the compact rounded look used for list filters. */
  variant?: "field" | "pill";
  id?: string;
  ariaLabel?: string;
}) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const search = useRef<HTMLInputElement>(null);

  const showSearch = searchable ?? options.length >= SEARCH_FROM;
  const selected = options.find((o) => o.value === value);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const matches = options.filter((o) => !needle || `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(needle));
    // Best matches first: label starts with the text, then the rest in their own order.
    if (needle) matches.sort((a, b) => Number(b.label.toLowerCase().startsWith(needle)) - Number(a.label.toLowerCase().startsWith(needle)));
    return matches;
  }, [options, q]);

  function openList() {
    if (disabled) return;
    const r = btn.current?.getBoundingClientRect();
    if (r) {
      const spaceBelow = window.innerHeight - r.bottom;
      setRect({ left: r.left, top: r.bottom + 6, width: r.width, up: spaceBelow < 280 && r.top > spaceBelow });
    }
    setQ("");
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    btn.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    if (showSearch) setTimeout(() => search.current?.focus(), 0);
    const close = (e: Event) => {
      const t = e.target as Node;
      if (list.current?.parentElement?.contains(t) || btn.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, showSearch]);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(rows.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = rows[active];
      if (o && !o.disabled) pick(o.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation(); // do not also close a modal this sits in
      setOpen(false);
      btn.current?.focus();
    }
  }

  const pad = variant === "pill" ? "h-8 text-xs font-medium rounded-full px-3" : size === "sm" ? "h-9 text-sm rounded-xl px-3.5" : "h-11 text-sm rounded-xl px-3.5";

  return (
    <div className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={value} />}
      {required && <input tabIndex={-1} aria-hidden required value={value} onChange={() => {}} className="pointer-events-none absolute inset-0 h-full w-full opacity-0" />}
      <button
        ref={btn}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openList();
          }
        }}
        className={`flex w-full items-center justify-between gap-2 border bg-white text-start transition focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400 ${pad} ${
          open ? "border-blue-500 ring-2 ring-blue-500/20" : "border-neutral-300 hover:border-neutral-400"
        }`}
      >
        <span className={`min-w-0 flex-1 truncate ${selected && selected.value !== "" ? "text-neutral-900" : "text-neutral-400"}`}>{selected ? selected.label : placeholder}</span>
        {clearable && selected && selected.value !== "" && !disabled ? (
          <span
            role="button"
            aria-label="Clear"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            ✕
          </span>
        ) : null}
        <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 shrink-0 text-neutral-400 transition ${open ? "rotate-180" : ""}`}>
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
        </svg>
      </button>

      {open && rect && (
        <>
          <div className="fixed inset-0 z-[2090] bg-neutral-900/40 md:hidden" />
          <div
            style={{ left: rect.left, width: Math.max(rect.width, 220), ...(rect.up ? { bottom: window.innerHeight - rect.top + 12 } : { top: rect.top }) }}
            className="fixed z-[2100] flex max-h-[min(22rem,60vh)] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl max-md:!inset-x-0 max-md:!bottom-0 max-md:!left-0 max-md:!top-auto max-md:!w-full max-md:max-h-[75vh] max-md:rounded-b-none max-md:pb-[env(safe-area-inset-bottom)]"
            onKeyDown={onKey}
          >
            {showSearch && (
              <div className="shrink-0 border-b border-neutral-100 p-2">
                <div className="relative">
                  <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">🔍</span>
                  <input
                    ref={search}
                    type="search"
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setActive(0);
                    }}
                    placeholder={searchPlaceholder}
                    aria-controls={`${uid}-list`}
                    className="h-10 w-full rounded-xl border border-neutral-200 bg-neutral-50 pe-3 ps-9 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
            )}
            <ul ref={list} id={`${uid}-list`} role="listbox" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
              {rows.length === 0 && <li className="px-3 py-6 text-center text-sm text-neutral-400">{emptyText}</li>}
              {rows.map((o, i) => {
                const heading = o.group && o.group !== rows[i - 1]?.group ? o.group : null;
                const isSel = o.value === value;
                return (
                  <li key={`${o.value}-${i}`} role="presentation">
                    {heading && <p className="px-3 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">{heading}</p>}
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSel}
                      data-i={i}
                      disabled={o.disabled}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => pick(o.value)}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-start text-sm disabled:opacity-40 ${
                        i === active ? "bg-blue-50" : ""
                      } ${isSel ? "font-bold text-blue-700" : "text-neutral-800"}`}
                    >
                      <span className={o.hint ? "shrink-0 whitespace-nowrap" : "min-w-0 flex-1 truncate"}>{o.label}</span>
                      {o.hint && <span className="min-w-0 flex-1 truncate text-end text-xs text-neutral-400">{o.hint}</span>}
                      {isSel && <span aria-hidden className="shrink-0 text-blue-700">✓</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

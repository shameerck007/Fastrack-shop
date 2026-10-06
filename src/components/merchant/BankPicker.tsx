"use client";

import { useEffect, useRef, useState } from "react";

const inputClass = "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm";

/** Searchable bank dropdown: type English or Arabic to filter. */
export default function BankPicker({
  value,
  onPick,
  banks,
  otherLabel,
  placeholder = "Select your bank",
}: {
  value: string;
  onPick: (name: string) => void;
  banks: { name: string; nameAr?: string }[];
  otherLabel: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | TouchEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const matches = banks.filter((b) => !q || b.name.toLowerCase().includes(q) || (b.nameAr ?? "").includes(q));
  const showOther = !q || otherLabel.toLowerCase().includes(q) || "other".includes(q);

  function pick(name: string) {
    onPick(name);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${inputClass} flex items-center justify-between bg-white text-left ${open ? "border-blue-500 ring-1 ring-blue-500" : ""}`}
      >
        <span className={value ? "" : "text-neutral-400"}>{value || placeholder}</span>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className={`shrink-0 text-neutral-400 transition ${open ? "rotate-180" : ""}`}>
          <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
          <div className="border-b border-neutral-100 p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search bank…  ابحث عن البنك"
              className="w-full rounded-lg bg-neutral-100 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
            {matches.map((b) => (
              <li key={b.name}>
                <button
                  type="button"
                  role="option"
                  aria-selected={b.name === value}
                  onClick={() => pick(b.name)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-blue-50 ${b.name === value ? "bg-blue-50 font-medium text-blue-700" : ""}`}
                >
                  <span>{b.name}</span>
                  {b.nameAr && <span className="text-xs text-neutral-400" dir="rtl">{b.nameAr}</span>}
                </button>
              </li>
            ))}
            {showOther && (
              <li>
                <button
                  type="button"
                  onClick={() => pick(otherLabel)}
                  className="w-full px-3 py-2 text-left text-sm text-neutral-600 hover:bg-blue-50"
                >
                  {otherLabel} (type the name)
                </button>
              </li>
            )}
            {matches.length === 0 && !showOther && <li className="px-3 py-3 text-sm text-neutral-400">No bank found</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

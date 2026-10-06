"use client";

import Link from "@/components/Link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useLocale } from "@/components/LocaleProvider";
import { useMoney } from "@/components/MoneyProvider";

interface Suggestion {
  id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  price: number | null;
}

export default function SearchBar({ defaultValue = "" }: { defaultValue?: string }) {
  const money = useMoney();
  const router = useRouter();
  const { t } = useLocale();
  const [value, setValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const query = value.trim();

    const timeout = setTimeout(async () => {
      if (query.length < 2) {
        setSuggestions([]);
        return;
      }
      try {
        const res = await fetch(`/api/search-suggestions?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSuggestions(data.results ?? []);
        setOpen(true);
      } catch {
        // Suggestions are a convenience — a failed fetch just means no dropdown.
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [value]);

  function goToSearch(query: string) {
    setOpen(false);
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <div ref={containerRef} className="relative">
      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          goToSearch(value);
        }}
      >
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
        >
          <circle cx="9" cy="9" r="6" />
          <path d="m14 14 4 4" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={t("header.search_placeholder")}
          className="w-full rounded-full border border-transparent bg-neutral-100 py-2.5 pe-4 ps-10 text-sm outline-none transition placeholder:text-neutral-400 focus:border-blue-500 focus:bg-white"
        />
      </form>

      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
          {suggestions.map((s) => (
            <Link
              key={s.id}
              href={`/products/${s.id}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 border-b border-neutral-100 px-4 py-2 last:border-none hover:bg-neutral-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-100">
                {s.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image_url} alt={s.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg">📦</span>
                )}
              </span>
              <span className="flex-1 truncate text-sm">
                <span className="font-medium text-neutral-900">{s.name}</span>
                {s.brand && <span className="ms-1 text-neutral-500">· {s.brand}</span>}
              </span>
              {s.price !== null && (
                <span className="text-sm font-medium text-blue-700">{money(s.price)}</span>
              )}
            </Link>
          ))}
          <button
            onClick={() => goToSearch(value)}
            className="block w-full px-4 py-2 text-start text-sm font-medium text-blue-700 hover:bg-neutral-50"
          >
            {t("header.see_all_results_for", { query: value })}
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatSAR } from "@/lib/utils";

interface Suggestion {
  id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  price: number | null;
}

export default function SearchBar({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
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
        onSubmit={(e) => {
          e.preventDefault();
          goToSearch(value);
        }}
      >
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Search vegetables, milk, rice... / موز، حليب، أرز"
          className="w-full rounded-full border border-neutral-300 px-4 py-2 text-sm outline-none focus:border-blue-500"
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
              <span className="text-lg">🛒</span>
              <span className="flex-1 truncate text-sm">
                <span className="font-medium text-neutral-900">{s.name}</span>
                {s.brand && <span className="ml-1 text-neutral-500">· {s.brand}</span>}
              </span>
              {s.price !== null && (
                <span className="text-sm font-medium text-blue-700">{formatSAR(s.price)}</span>
              )}
            </Link>
          ))}
          <button
            onClick={() => goToSearch(value)}
            className="block w-full px-4 py-2 text-left text-sm font-medium text-blue-700 hover:bg-neutral-50"
          >
            See all results for &ldquo;{value}&rdquo;
          </button>
        </div>
      )}
    </div>
  );
}

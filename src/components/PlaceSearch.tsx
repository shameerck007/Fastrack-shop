"use client";

import { useEffect, useRef, useState } from "react";
import { searchPlaces, type PlaceResult } from "@/lib/map-config";

// Search box for finding an area/address/landmark and jumping the map there.
// Searches as you type (debounced, to respect the free geocoder's limits).
export default function PlaceSearch({
  onSelect,
  placeholder = "Search area, street or landmark (e.g. Olaya, Riyadh)",
}: {
  onSelect: (place: PlaceResult) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      setError(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await searchPlaces(query);
        if (!cancelled) {
          setResults(r);
          setOpen(true);
          if (r.length === 0) setError("No places found — try a different spelling or a nearby landmark.");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Search failed.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 focus-within:border-blue-500">
        <span aria-hidden>🔍</span>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm outline-none"
        />
        {loading && <span className="text-xs text-neutral-400">Searching…</span>}
        {query && !loading && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
            }}
            className="text-neutral-400 hover:text-neutral-700"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {open && (results.length > 0 || error) && (
        <div className="absolute z-[1000] mt-1 w-full overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
          {error && results.length === 0 && <p className="px-3 py-2 text-sm text-neutral-500">{error}</p>}
          {results.map((r, i) => (
            <button
              key={`${r.lat}-${r.lng}-${i}`}
              type="button"
              onClick={() => {
                onSelect(r);
                setQuery(r.label);
                setOpen(false);
              }}
              className="flex w-full flex-col items-start border-b border-neutral-100 px-3 py-2 text-left last:border-none hover:bg-blue-50"
            >
              <span className="text-sm font-medium text-neutral-900">📍 {r.label}</span>
              <span className="text-xs text-neutral-500">{r.detail}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

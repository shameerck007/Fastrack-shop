"use client";

import { useState, useTransition } from "react";
import { setLandingPreference } from "@/lib/actions/landing";

/** "When I open FasTrack, take me to…" — shown to accounts that have a portal (rider, supplier, admin, staff). */
export default function LandingPreference({
  initial,
  portalLabel,
}: {
  initial: "portal" | "shop";
  portalLabel: string;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(next: "portal" | "shop") {
    if (next === value) return;
    const previous = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const res = await setLandingPreference(next);
      if (res.error) {
        setValue(previous);
        setError(res.error);
      }
    });
  }

  const options: { key: "portal" | "shop"; icon: string; title: string; desc: string }[] = [
    { key: "portal", icon: "🧭", title: portalLabel, desc: "Open your dashboard when you sign in or open the app." },
    { key: "shop", icon: "🛍️", title: "Shopping page", desc: "Open the shop first. Your dashboard is one tap away in Account." },
  ];

  return (
    <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xl">🏠</span>
        <span className="flex flex-col">
          <span className="font-medium text-neutral-900">Default landing page</span>
          <span className="text-sm text-neutral-500">Choose what opens first when you use FasTrack.</span>
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            disabled={pending}
            onClick={() => choose(o.key)}
            className={`flex items-start gap-3 rounded-xl border p-3 text-left transition disabled:opacity-60 ${
              value === o.key ? "border-blue-600 bg-blue-50" : "border-neutral-300 hover:border-blue-300"
            }`}
          >
            <span className="text-xl">{o.icon}</span>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-neutral-900">{o.title}</span>
              <span className="block text-xs text-neutral-500">{o.desc}</span>
            </span>
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                value === o.key ? "border-blue-600 bg-blue-600 text-white" : "border-neutral-300"
              }`}
            >
              {value === o.key ? "✓" : ""}
            </span>
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

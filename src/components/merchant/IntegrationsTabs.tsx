"use client";

import { useEffect, useState } from "react";

export interface IntegrationTab {
  id: string;
  label: string;
  icon: string;
  hint: string;
  content: React.ReactNode;
}

/** Tabs for the Import & API page. The open tab is kept in the address (#api, #webhook ...) so a link opens the right one. */
export default function IntegrationsTabs({ tabs }: { tabs: IntegrationTab[] }) {
  const [active, setActive] = useState(tabs[0].id);

  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.replace("#", "");
      if (tabs.some((t) => t.id === h)) setActive(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [tabs]);

  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div>
      <div role="tablist" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0">
        {tabs.map((t) => {
          const on = t.id === current.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              onClick={() => {
                setActive(t.id);
                history.replaceState(null, "", `#${t.id}`);
              }}
              className={`flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-left transition ${
                on ? "border-blue-600 bg-blue-50 text-blue-900 shadow-sm" : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
              }`}
            >
              <span className="text-lg" aria-hidden>{t.icon}</span>
              <span className="leading-tight">
                <span className="block text-sm font-semibold">{t.label}</span>
                <span className="block text-[11px] text-neutral-500">{t.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="mt-4">
        {current.content}
      </div>
    </div>
  );
}

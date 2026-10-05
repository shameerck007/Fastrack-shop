"use client";

import ImageUploader from "@/components/ImageUploader";
import { DAY_KEYS, DAY_NAMES, defaultOpeningHours, type DayHours, type OpeningHours } from "@/lib/store-hours";

export interface StoreProfileValue {
  logoUrl: string | null;
  coverUrl: string | null;
  tagline: string;
  hours: OpeningHours;
}

const inputClass = "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm";

/** Logo, cover photo, tagline and weekly opening hours — shared by the
 * onboarding form and the merchant's own profile page. */
export default function StoreProfileFields({
  value,
  onChange,
}: {
  value: StoreProfileValue;
  onChange: (next: StoreProfileValue) => void;
}) {
  const set = (patch: Partial<StoreProfileValue>) => onChange({ ...value, ...patch });

  function setDay(key: string, patch: Partial<DayHours>) {
    if (!value.hours) return;
    set({ hours: { ...value.hours, [key]: { ...value.hours[key], ...patch } } });
  }

  function copyFirstToAll() {
    if (!value.hours) return;
    const first = value.hours["0"];
    set({ hours: Object.fromEntries(DAY_KEYS.map((k) => [k, { ...first }])) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-6">
        <div>
          <p className="mb-1 text-sm font-medium">Shop logo</p>
          <ImageUploader value={value.logoUrl} onChange={(logoUrl) => set({ logoUrl })} alt="Shop logo" emoji="🏪" />
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">Cover photo</p>
          <ImageUploader value={value.coverUrl} onChange={(coverUrl) => set({ coverUrl })} alt="Cover" emoji="🖼️" wide />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Tagline</label>
        <input
          value={value.tagline}
          maxLength={80}
          onChange={(e) => set({ tagline: e.target.value })}
          placeholder="e.g. Fried chicken, burgers & sides"
          className={inputClass}
        />
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={value.hours !== null}
            onChange={(e) => set({ hours: e.target.checked ? defaultOpeningHours() : null })}
          />
          Set opening hours
        </label>
        <p className="mb-2 mt-0.5 text-xs text-neutral-400">
          Customers can&apos;t order from your shop outside these hours (Riyadh time). Leave unchecked to be open all day, every day.
        </p>

        {value.hours && (
          <div className="rounded-xl border border-neutral-200">
            {DAY_KEYS.map((key, i) => {
              const day = value.hours![key];
              return (
                <div key={key} className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-3 py-2 last:border-none">
                  <span className="w-24 text-sm font-medium">{DAY_NAMES[i]}</span>
                  <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                    <input type="checkbox" checked={day.closed} onChange={(e) => setDay(key, { closed: e.target.checked })} />
                    Closed
                  </label>
                  {!day.closed && (
                    <span className="flex items-center gap-2">
                      <input
                        type="time"
                        value={day.open}
                        onChange={(e) => setDay(key, { open: e.target.value })}
                        className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                      />
                      <span className="text-xs text-neutral-400">to</span>
                      <input
                        type="time"
                        value={day.close}
                        onChange={(e) => setDay(key, { close: e.target.value })}
                        className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                      />
                    </span>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={copyFirstToAll}
              className="m-2 rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium hover:bg-neutral-100"
            >
              Copy Sunday&apos;s hours to every day
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

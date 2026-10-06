"use client";

import ImageUploader from "@/components/ImageUploader";
import { useMarket } from "@/components/MoneyProvider";
import { marketClockName } from "@/lib/timezone";
import {
  DAY_KEYS,
  DAY_NAMES,
  MAX_SHIFTS_PER_DAY,
  defaultOpeningHours,
  shiftsOf,
  withShifts,
  type DayHours,
  type OpeningHours,
  type Shift,
} from "@/lib/store-hours";

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
  const clockName = marketClockName(useMarket().countryCode);
  const set = (patch: Partial<StoreProfileValue>) => onChange({ ...value, ...patch });

  function setDay(key: string, patch: Partial<DayHours>) {
    if (!value.hours) return;
    set({ hours: { ...value.hours, [key]: { ...value.hours[key], ...patch } } });
  }

  function updateShifts(key: string, change: (shifts: Shift[]) => Shift[]) {
    if (!value.hours) return;
    const day = value.hours[key];
    // replace the whole day (not merge) so a removed extra period really goes away
    set({ hours: { ...value.hours, [key]: withShifts(day, change(shiftsOf(day))) } });
  }

  const setShift = (key: string, n: number, patch: Partial<Shift>) =>
    updateShifts(key, (shifts) => shifts.map((s, idx) => (idx === n ? { ...s, ...patch } : s)));

  const removeShift = (key: string, n: number) => updateShifts(key, (shifts) => shifts.filter((_, idx) => idx !== n));

  const addShift = (key: string) =>
    updateShifts(key, (shifts) => {
      const last = shifts[shifts.length - 1];
      // First extra period: turn the day into a lunch-break split instead of
      // stacking an overlapping range on top of the all-day one.
      if (shifts.length === 1 && last.close > "15:00" && last.open < "13:00") {
        return [{ open: last.open, close: "13:00" }, { open: "17:00", close: last.close > "17:00" ? last.close : "23:00" }];
      }
      return [...shifts, { open: last && last.close < "21:00" ? last.close : "17:00", close: "23:00" }];
    });

  function copyFirstToAll() {
    if (!value.hours) return;
    const first = value.hours["0"];
    set({ hours: Object.fromEntries(DAY_KEYS.map((k) => [k, { ...first, more: first.more?.map((m) => ({ ...m })) }])) });
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
          Customers can&apos;t order from your shop outside these hours ({clockName}). Leave unchecked to be open all day, every day.
        </p>

        {value.hours && (
          <div className="rounded-xl border border-neutral-200">
            {DAY_KEYS.map((key, i) => {
              const day = value.hours![key];
              return (
                <div key={key} className="flex flex-wrap items-start gap-3 border-b border-neutral-100 px-3 py-2 last:border-none">
                  <span className="w-24 pt-1 text-sm font-medium">{DAY_NAMES[i]}</span>
                  <label className="flex items-center gap-1.5 pt-1 text-xs text-neutral-600">
                    <input type="checkbox" checked={day.closed} onChange={(e) => setDay(key, { closed: e.target.checked })} />
                    Closed
                  </label>
                  {!day.closed && (
                    <div className="flex flex-col gap-1.5">
                      {shiftsOf(day).map((shift, n, all) => (
                        <span key={n} className="flex items-center gap-2">
                          <input
                            type="time"
                            value={shift.open}
                            onChange={(e) => setShift(key, n, { open: e.target.value })}
                            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                          />
                          <span className="text-xs text-neutral-400">to</span>
                          <input
                            type="time"
                            value={shift.close}
                            onChange={(e) => setShift(key, n, { close: e.target.value })}
                            className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                          />
                          {all.length > 1 && (
                            <button type="button" onClick={() => removeShift(key, n)} className="text-xs text-neutral-400 hover:text-red-600" aria-label="Remove this period">
                              ✕
                            </button>
                          )}
                        </span>
                      ))}
                      {shiftsOf(day).length < MAX_SHIFTS_PER_DAY && (
                        <button type="button" onClick={() => addShift(key)} className="self-start text-xs font-medium text-blue-600 hover:underline">
                          + Add another period (closed in between)
                        </button>
                      )}
                    </div>
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

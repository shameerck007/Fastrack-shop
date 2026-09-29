import { formatSAR } from "@/lib/utils";
import type { DayEarnings } from "@/lib/rider";

export default function RiderEarningsChart({
  days,
  t,
}: {
  days: DayEarnings[];
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const total = days.reduce((sum, d) => sum + d.earnings, 0);
  const max = Math.max(...days.map((d) => d.earnings), 1);
  const peakIndex = days.reduce((best, d, i) => (d.earnings > days[best].earnings ? i : best), 0);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-700">{t("rider.this_week")}</h2>
        <span className="text-sm font-semibold text-neutral-900">{formatSAR(total)}</span>
      </div>

      {/* Fixed-height row so each bar's percentage height resolves against a
          real pixel value — day labels live in a separate row below so they
          never influence (or get squashed by) that height. */}
      <div className="flex h-24 items-end gap-2">
        {days.map((d, i) => {
          const heightPct = Math.max((d.earnings / max) * 100, d.earnings > 0 ? 6 : 3);
          const isPeak = i === peakIndex && d.earnings > 0;
          return (
            <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              {isPeak && <span className="text-[10px] font-semibold text-blue-700">{formatSAR(d.earnings)}</span>}
              <div
                title={`${d.label}: ${formatSAR(d.earnings)} · ${d.deliveries}`}
                className="w-full rounded-t-md"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: d.earnings > 0 ? "#2563eb" : "#e5e5e5",
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-2">
        {days.map((d) => (
          <span key={d.date} className="flex-1 text-center text-[10px] font-medium text-neutral-400">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

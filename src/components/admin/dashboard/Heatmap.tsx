const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => (h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`);

/** When orders come in: weekday by hour of the day, darker = busier. Hover a cell for the count. */
export default function Heatmap({ cells }: { cells: [number, number, number][] }) {
  const grid = new Map<string, number>();
  let max = 0;
  for (const [dow, hr, n] of cells) {
    grid.set(`${dow}-${hr}`, n);
    max = Math.max(max, n);
  }
  if (max === 0) return <p className="py-6 text-center text-sm text-neutral-400">No orders in this period yet.</p>;
  const peak = [...grid.entries()].sort((a, b) => b[1] - a[1])[0];
  const [pd, ph] = peak[0].split("-").map(Number);
  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[34rem]">
          <div className="grid gap-[3px]" style={{ gridTemplateColumns: "2.25rem repeat(24, minmax(0, 1fr))" }}>
            <span />
            {HOURS.map((h) => (
              <span key={h} className="text-center text-[9px] leading-none text-neutral-400">
                {h % 3 === 0 ? hourLabel(h) : ""}
              </span>
            ))}
            {DAYS.map((d, i) => (
              <div key={d} className="contents">
                <span className="self-center text-[11px] font-semibold text-neutral-500">{d}</span>
                {HOURS.map((h) => {
                  const n = grid.get(`${i + 1}-${h}`) ?? 0;
                  return (
                    <span
                      key={h}
                      title={`${d} ${hourLabel(h)}: ${n} order${n === 1 ? "" : "s"}`}
                      className="aspect-square rounded-[4px]"
                      style={{ backgroundColor: n === 0 ? "#f3f4f6" : `rgba(37, 99, 235, ${0.18 + (n / max) * 0.82})` }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-neutral-500">
        Busiest: <b className="text-neutral-800">{DAYS[pd - 1]} around {hourLabel(ph)}</b> ({peak[1]} order{peak[1] === 1 ? "" : "s"}).
      </p>
    </div>
  );
}

import { formatSAR } from "@/lib/utils";
import type { DailyRevenuePoint } from "@/lib/admin-analytics";

const WIDTH = 700;
const HEIGHT = 180;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;
const PAD_BOTTOM = 24;
const PAD_TOP = 12;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Deterministic, timezone-free date formatting — new Date(...).toLocaleDateString()
// reads the runtime's default locale/timezone, which differs between the
// server (SSR) and the browser and causes a hydration mismatch. Parsing the
// yyyy-mm-dd string directly and computing the weekday via Zeller-ish
// arithmetic on the UTC epoch avoids any environment-dependent Date API.
function formatDay(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return { day: d, label: `${weekday}, ${MONTHS[m - 1]} ${d}` };
}

export default function RevenueTrendChart({ data }: { data: DailyRevenuePoint[] }) {
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const barGap = 6;
  const barWidth = data.length > 0 ? (plotWidth - barGap * (data.length - 1)) / data.length : 0;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-44 w-full" role="img" aria-label="Daily revenue, last 14 days">
      <line
        x1={PAD_LEFT}
        y1={HEIGHT - PAD_BOTTOM}
        x2={WIDTH - PAD_RIGHT}
        y2={HEIGHT - PAD_BOTTOM}
        stroke="#e5e5e5"
        strokeWidth={1}
      />
      {data.map((d, i) => {
        const barHeight = max > 0 ? (d.revenue / max) * plotHeight : 0;
        const x = PAD_LEFT + i * (barWidth + barGap);
        const y = HEIGHT - PAD_BOTTOM - barHeight;
        const { day, label } = formatDay(d.date);
        const showLabel = i % 2 === 0;
        return (
          <g key={d.date}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barHeight, d.revenue > 0 ? 2 : 0)}
              rx={3}
              fill="#2563eb"
              opacity={d.revenue > 0 ? 1 : 0.15}
            >
              <title>{`${label}: ${formatSAR(d.revenue)} · ${d.orders} order${d.orders === 1 ? "" : "s"}`}</title>
            </rect>
            {d.revenue === 0 && (
              <rect x={x} y={HEIGHT - PAD_BOTTOM - 2} width={barWidth} height={2} rx={1} fill="#2563eb" opacity={0.15} />
            )}
            {showLabel && (
              <text
                x={x + barWidth / 2}
                y={HEIGHT - 6}
                textAnchor="middle"
                fontSize="9"
                fill="#a3a3a3"
              >
                {day}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export interface BarListItem {
  label: string;
  value: number;
  color?: string;
}

export default function BarList({
  items,
  formatValue,
  emptyLabel = "No data yet",
}: {
  items: BarListItem[];
  formatValue: (value: number) => string;
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-neutral-400">{emptyLabel}</p>;
  }

  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-xs text-neutral-600" title={item.label}>
            {item.label}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max((item.value / max) * 100, item.value > 0 ? 3 : 0)}%`,
                backgroundColor: item.color ?? "#2563eb",
              }}
            />
          </div>
          <span className="w-20 shrink-0 text-right text-xs font-medium text-neutral-700">
            {formatValue(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

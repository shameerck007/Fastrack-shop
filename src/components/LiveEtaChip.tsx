/** A small "arriving about 7:42 PM" tag with a live dot, amber when the order is running behind what was promised. */
export default function LiveEtaChip({ clock, lateBy = 0, stopsBefore = 0, label = "Arriving about", onTime = "On time", lateText = "late", stopsText, className = "" }: { clock: string; lateBy?: number; stopsBefore?: number; label?: string; onTime?: string; lateText?: string; stopsText?: string; className?: string }) {
  const late = lateBy > 0;
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-full px-2.5 py-1 text-xs font-semibold ${late ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"} ${className}`}>
      <span className="inline-flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${late ? "bg-amber-500" : "bg-emerald-500"}`} />
        {label} <b>{clock}</b>
      </span>
      <span className="font-bold">{late ? `+${lateBy} min ${lateText}` : onTime}</span>
      {stopsBefore > 0 && stopsText && <span className="font-medium opacity-80">· {stopsText}</span>}
    </span>
  );
}

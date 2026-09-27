import type { FulfillmentSummary } from "@/lib/admin-orders";

// FasTrack's own stock (blue) vs. a third-party merchant's (amber) vs. an
// order mixing both — admins need this at a glance to know who's actually
// responsible for packing/shipping each line.
export default function FulfillmentBadge({ fulfillment }: { fulfillment: FulfillmentSummary }) {
  const { fromFastrack, merchantNames } = fulfillment;

  if (fromFastrack && merchantNames.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
        🏬 FasTrack
      </span>
    );
  }

  if (!fromFastrack && merchantNames.length === 1) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
        🏪 {merchantNames[0]}
      </span>
    );
  }

  const sources = [...(fromFastrack ? ["FasTrack"] : []), ...merchantNames];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700"
      title={sources.join(", ")}
    >
      🔀 Mixed ({sources.length})
    </span>
  );
}

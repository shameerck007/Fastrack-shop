import type { OrderStatus } from "@/types/database";

// Collapses the order's full status list to the 4 stages a rider actually
// cares about once they're assigned — rider_assigned/ready_for_pickup/
// preparing are all "not picked up yet" from the rider's point of view.
const STEP_KEYS = ["step_assigned", "step_pickup", "step_delivering", "step_delivered"] as const;

function stepIndex(status: OrderStatus): number {
  if (status === "delivered") return 3;
  if (status === "out_for_delivery") return 2;
  if (status === "rider_assigned" || status === "ready_for_pickup" || status === "preparing") return 0;
  return 0;
}

// Takes `t` as a prop (not the useLocale hook) so it can render from either
// a server component (dashboard card) or a client one without forcing a
// "use client" boundary just for translation.
export default function DeliveryProgressStepper({
  status,
  t,
}: {
  status: OrderStatus;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const current = stepIndex(status);

  return (
    <div className="flex items-center">
      {STEP_KEYS.map((key, i) => {
        const done = i <= current;
        const isLast = i === STEP_KEYS.length - 1;
        return (
          <div key={key} className={`flex items-center ${isLast ? "" : "flex-1"}`}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition ${
                  done ? "bg-blue-700 text-white" : "bg-neutral-200 text-neutral-500"
                }`}
              >
                {i < current ? "✓" : i + 1}
              </div>
              <span className={`whitespace-nowrap text-[10px] font-medium ${done ? "text-blue-700" : "text-neutral-400"}`}>
                {t(`rider.${key}`)}
              </span>
            </div>
            {!isLast && (
              <div className={`mx-1 h-0.5 flex-1 rounded-full transition ${i < current ? "bg-blue-700" : "bg-neutral-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

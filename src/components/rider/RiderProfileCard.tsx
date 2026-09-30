import AvailabilityToggle from "@/components/rider/AvailabilityToggle";
import type { DeliveryPartner, Profile } from "@/types/database";

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

function Stars({ rating }: { rating: number | null }) {
  if (rating == null) return null;
  const full = Math.round(rating);
  return (
    <span className="text-sm text-amber-500">
      {"★".repeat(full)}
      <span className="text-neutral-300">{"★".repeat(5 - full)}</span>
      <span className="ms-1 text-xs font-medium text-neutral-600">{rating.toFixed(1)}</span>
    </span>
  );
}

const VEHICLE_ICON: Record<string, string> = {
  motorbike: "🏍️",
  motorcycle: "🏍️",
  car: "🚗",
  bicycle: "🚲",
};

// Older test/seed data used "motorcycle"; the apply form's own options are
// motorbike/car/bicycle. Normalize so either spelling finds a translation
// instead of falling through to a raw, untranslated key.
const VEHICLE_LABEL_KEY: Record<string, string> = {
  motorbike: "become_rider.vehicle_motorbike",
  motorcycle: "become_rider.vehicle_motorbike",
  car: "become_rider.vehicle_car",
  bicycle: "become_rider.vehicle_bicycle",
};

export default function RiderProfileCard({
  profile,
  deliveryPartner,
  t,
  locale,
}: {
  profile: Profile;
  deliveryPartner: DeliveryPartner;
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: string;
}) {
  const name = profile.full_name ?? t("rider.rider");
  const vehicleIcon = deliveryPartner.vehicle_type ? VEHICLE_ICON[deliveryPartner.vehicle_type] ?? "🛵" : "🛵";

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-700 text-lg font-bold text-white">
          {initials(name)}
        </span>
        <div>
          <p className="font-semibold text-neutral-900">{name}</p>
          {deliveryPartner.rating != null ? (
            <Stars rating={deliveryPartner.rating} />
          ) : (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              {t("rider.new_rider_badge")}
            </span>
          )}
          <p className="mt-0.5 text-xs text-neutral-500">
            {vehicleIcon} {t(VEHICLE_LABEL_KEY[deliveryPartner.vehicle_type ?? "motorbike"] ?? "become_rider.vehicle_motorbike")} ·{" "}
            {t("rider.member_since", {
              date: new Date(deliveryPartner.created_at).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
                month: "short",
                year: "numeric",
              }),
            })}
          </p>
        </div>
      </div>
      <AvailabilityToggle isAvailable={deliveryPartner.is_available} size="lg" />
    </div>
  );
}

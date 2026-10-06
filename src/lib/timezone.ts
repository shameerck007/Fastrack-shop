// Each market runs on one fixed clock. Neither Saudi Arabia nor India uses daylight saving,
// so a fixed offset is exact. Shop opening hours and delivery dates are read in the market's time.

const OFFSET_MINUTES: Record<string, number> = {
  SA: 180, // Arabia Standard Time, UTC+3
  IN: 330, // India Standard Time, UTC+5:30
};

export const DEFAULT_OFFSET_MINUTES = OFFSET_MINUTES.SA;

export function marketOffsetMinutes(countryCode: string | null | undefined): number {
  return OFFSET_MINUTES[(countryCode ?? "SA").toUpperCase()] ?? DEFAULT_OFFSET_MINUTES;
}

/** How the clock is named to shop owners: "Riyadh time" / "India time (IST)". */
export function marketClockName(countryCode: string | null | undefined): string {
  return (countryCode ?? "SA").toUpperCase() === "IN" ? "India time (IST)" : "Riyadh time";
}

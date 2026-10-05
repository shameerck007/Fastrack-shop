// Opening hours for supplier stores. Weekday keys are "0" (Sunday) .. "6"
// (Saturday); times are 24h "HH:MM" in Riyadh time (Saudi Arabia has no DST,
// so this is a fixed UTC+3). A close time earlier than the open time means
// the shop runs past midnight (open 18:00, close 02:00).

export interface Shift {
  open: string;
  close: string;
}

/** `open`/`close` are the day's first shift (kept as-is so hours saved before
 * split shifts existed still read correctly); `more` holds any extra shifts
 * the same day, e.g. 09:00-13:00 then 17:00-23:00 for a shop that closes
 * in the middle of the day. */
export interface DayHours {
  closed: boolean;
  open: string;
  close: string;
  more?: Shift[];
}
export type OpeningHours = Record<string, DayHours> | null;

export const MAX_SHIFTS_PER_DAY = 3;

/** All of a day's shifts in order, or none if the day is closed. */
export function shiftsOf(day: DayHours | undefined): Shift[] {
  if (!day || day.closed) return [];
  return [{ open: day.open, close: day.close }, ...(day.more ?? [])];
}

/** Writes a list of shifts back into the DayHours shape. */
export function withShifts(day: DayHours, shifts: Shift[]): DayHours {
  const [first, ...rest] = shifts.length ? shifts : [{ open: day.open, close: day.close }];
  const next: DayHours = { closed: day.closed, open: first.open, close: first.close };
  if (rest.length) next.more = rest;
  return next;
}

export const DAY_KEYS = ["0", "1", "2", "3", "4", "5", "6"] as const;
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function defaultOpeningHours(): Record<string, DayHours> {
  return Object.fromEntries(DAY_KEYS.map((k) => [k, { closed: false, open: "09:00", close: "23:00" }]));
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Server-side guard for hours coming from a form: returns a clean copy or throws. */
export function sanitizeOpeningHours(input: unknown): Record<string, DayHours> | null {
  if (input == null) return null;
  if (typeof input !== "object") throw new Error("Invalid opening hours.");
  const out: Record<string, DayHours> = {};
  for (const key of DAY_KEYS) {
    const day = (input as Record<string, Partial<DayHours>>)[key];
    if (!day) throw new Error("Opening hours must cover every day of the week.");
    const closed = !!day.closed;
    const raw: Shift[] = [{ open: String(day.open ?? ""), close: String(day.close ?? "") }];
    if (Array.isArray(day.more)) {
      for (const m of day.more) raw.push({ open: String(m?.open ?? ""), close: String(m?.close ?? "") });
    }
    if (raw.length > MAX_SHIFTS_PER_DAY) throw new Error(`At most ${MAX_SHIFTS_PER_DAY} opening periods per day.`);
    if (!closed && raw.some((r) => !TIME_RE.test(r.open) || !TIME_RE.test(r.close))) {
      throw new Error("Opening and closing times must look like 09:00.");
    }
    out[key] = closed
      ? { closed: true, open: TIME_RE.test(raw[0].open) ? raw[0].open : "09:00", close: TIME_RE.test(raw[0].close) ? raw[0].close : "23:00" }
      : withShifts({ closed: false, open: raw[0].open, close: raw[0].close }, raw);
  }
  return out;
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Current weekday (0 = Sunday) and minutes since midnight in Riyadh. */
export function riyadhNow(date: Date = new Date()): { day: number; minutes: number } {
  const shifted = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  return { day: shifted.getUTCDay(), minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes() };
}

export interface NextOpening {
  /** 0 = later today, 1 = tomorrow, 2+ = that many days ahead. */
  daysAhead: number;
  day: number;
  time: string;
}

export interface OpenStatus {
  open: boolean;
  reason: "paused" | "closed" | null;
  /** Set when closed and the shop has an upcoming opening. */
  next: NextOpening | null;
  /** Set when open and hours are configured: today's closing time ("23:00"). */
  closesAt: string | null;
}

export function getOpenStatus(hours: OpeningHours, acceptingOrders: boolean, now: Date = new Date()): OpenStatus {
  if (!acceptingOrders) return { open: false, reason: "paused", next: null, closesAt: null };
  if (!hours) return { open: true, reason: null, next: null, closesAt: null };

  const { day, minutes } = riyadhNow(now);

  // Still inside one of yesterday's late-night shifts (e.g. 18:00 -> 02:00).
  for (const shift of shiftsOf(hours[String((day + 6) % 7)])) {
    const o = toMinutes(shift.open);
    const c = toMinutes(shift.close);
    if (c <= o && minutes < c) return { open: true, reason: null, next: null, closesAt: shift.close };
  }

  // Today's shifts: open if inside any; otherwise remember the next one to start.
  let nextToday: Shift | null = null;
  for (const shift of shiftsOf(hours[String(day)])) {
    const o = toMinutes(shift.open);
    const c = toMinutes(shift.close);
    const inside = c > o ? minutes >= o && minutes < c : minutes >= o; // overnight: open until midnight, the rest counts tomorrow
    if (inside) return { open: true, reason: null, next: null, closesAt: shift.close };
    if (minutes < o && (!nextToday || o < toMinutes(nextToday.open))) nextToday = shift;
  }
  if (nextToday) return { open: false, reason: "closed", next: { daysAhead: 0, day, time: nextToday.open }, closesAt: null };

  for (let ahead = 1; ahead <= 7; ahead++) {
    const d = (day + ahead) % 7;
    const shifts = shiftsOf(hours[String(d)]);
    if (shifts.length) {
      const earliest = shifts.reduce((a, b) => (toMinutes(b.open) < toMinutes(a.open) ? b : a));
      return { open: false, reason: "closed", next: { daysAhead: ahead, day: d, time: earliest.open }, closesAt: null };
    }
  }
  return { open: false, reason: "closed", next: null, closesAt: null };
}

/** "9:00 AM" / "٩:٠٠ ص" for a 24h "HH:MM" string. */
export function formatClock(hhmm: string, locale: string): string {
  const d = new Date(Date.UTC(2000, 0, 1, ...(hhmm.split(":").map(Number) as [number, number])));
  return d.toLocaleTimeString(locale === "ar" ? "ar-SA" : "en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}

/** "Today 9:00 AM" / "Tomorrow 9:00 AM" / "Sun 9:00 AM". */
export function formatNextOpening(next: NextOpening, locale: string, words: { today: string; tomorrow: string }): string {
  const time = formatClock(next.time, locale);
  if (next.daysAhead === 0) return `${words.today} ${time}`;
  if (next.daysAhead === 1) return `${words.tomorrow} ${time}`;
  const weekday = new Date(Date.UTC(2000, 0, 2 + next.day)).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
  return `${weekday} ${time}`;
}

type Translate = (key: string, vars?: Record<string, string | number>) => string;

/** "Open · Closes 11:00 PM" / "Closed · Opens tomorrow 9:00 AM" / "Not taking orders". */
export function describeStatus(status: OpenStatus, locale: string, t: Translate): { text: string; open: boolean } {
  if (status.open) {
    const closes = status.closesAt ? ` · ${t("store.closes", { time: formatClock(status.closesAt, locale) })}` : "";
    return { open: true, text: `${t("store.open")}${closes}` };
  }
  if (status.reason === "paused") return { open: false, text: t("store.paused") };
  const when = status.next
    ? formatNextOpening(status.next, locale, { today: t("store.today"), tomorrow: t("store.tomorrow") })
    : null;
  return { open: false, text: when ? `${t("store.closed")} · ${t("store.opens", { when })}` : t("store.closed") };
}

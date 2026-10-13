export type BannerTheme = "blue" | "green" | "orange" | "teal";
export const BANNER_THEMES: { value: BannerTheme; label: string }[] = [
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
  { value: "orange", label: "Orange" },
  { value: "teal", label: "Teal" },
];

/** One row of home_banners. */
export interface BannerRow {
  id: string;
  eyebrow: string | null;
  title: string;
  title_ar: string | null;
  subtitle: string | null;
  subtitle_ar: string | null;
  cta_label: string | null;
  cta_label_ar: string | null;
  link_url: string | null;
  theme: BannerTheme;
  image_url: string | null;
  photos: string[] | null;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
}

export type BannerStatus = "live" | "scheduled" | "ended" | "off";

export function bannerStatus(b: Pick<BannerRow, "is_active" | "starts_at" | "ends_at">, now = Date.now()): BannerStatus {
  if (!b.is_active) return "off";
  if (b.starts_at && new Date(b.starts_at).getTime() > now) return "scheduled";
  if (b.ends_at && new Date(b.ends_at).getTime() <= now) return "ended";
  return "live";
}

/** A banner link may go to a page of the shop ("/offers"), a place on the home page ("#offers") or a full https address. Returns null when it is none of those. */
export function cleanBannerLink(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "";
  if (/^(\/(?!\/)|#)[^\s]*$/.test(v) || /^https:\/\/[^\s]+$/i.test(v)) return v;
  return null;
}

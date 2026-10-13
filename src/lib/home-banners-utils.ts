import type { HeroSlide } from "@/components/HomeHero";

export type BannerTheme = "blue" | "green" | "orange" | "teal";
export const BANNER_THEMES: { value: BannerTheme; label: string }[] = [
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
  { value: "orange", label: "Orange" },
  { value: "teal", label: "Teal" },
];

export type AutoBannerType = "welcome" | "fresh_today" | "deals" | "free_delivery" | "best_sellers";
export const AUTO_BANNER_TYPES: { value: AutoBannerType; label: string; hint: string }[] = [
  { value: "welcome", label: "Welcome", hint: "The shop greeting, with category photos." },
  { value: "fresh_today", label: "Fresh today", hint: "Photos of today's fresh products." },
  { value: "deals", label: "Deals", hint: "Photos of products on offer; the title shows the biggest discount." },
  { value: "free_delivery", label: "Free delivery", hint: "Shows the free-delivery amount. Only appears while free delivery is switched on." },
  { value: "best_sellers", label: "Best sellers", hint: "Photos of the best-selling products." },
];

/** One row of home_banners. */
export interface BannerRow {
  id: string;
  kind: "custom" | "auto";
  auto_type: AutoBannerType | null;
  eyebrow: string | null;
  title: string | null;
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

/**
 * One banner row as a slide. A custom banner is exactly what the admin typed; an auto banner starts from the live slide
 * (photos, numbers, wording in the shopper's language) and any wording the admin filled in replaces the matching part.
 * Null for an auto banner that has nothing to show right now.
 */
export function bannerSlide(b: BannerRow, ar: boolean, auto: Record<AutoBannerType, HeroSlide | null>): HeroSlide | null {
  const text = (en: string | null, arText: string | null) => ((ar && arText) || en || "").trim();
  if (b.kind === "auto") {
    const base = b.auto_type ? auto[b.auto_type] : null;
    if (!base) return null;
    return {
      ...base,
      id: `banner-${b.id}`,
      eyebrow: text(b.eyebrow, null) || base.eyebrow,
      title: text(b.title, b.title_ar) || base.title,
      subtitle: text(b.subtitle, b.subtitle_ar) || base.subtitle,
      cta: text(b.cta_label, b.cta_label_ar) || base.cta,
      href: b.link_url || base.href,
    };
  }
  return {
    id: `banner-${b.id}`,
    theme: b.theme,
    eyebrow: b.eyebrow ?? "",
    title: text(b.title, b.title_ar),
    subtitle: text(b.subtitle, b.subtitle_ar),
    cta: text(b.cta_label, b.cta_label_ar),
    href: b.link_url ?? "",
    images: (b.photos ?? []).map((src) => ({ src, alt: "" })),
    cover: b.image_url ?? undefined,
  };
}

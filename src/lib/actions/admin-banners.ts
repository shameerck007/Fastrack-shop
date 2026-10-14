"use server";

import { failure, friendlyMessage } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AUTO_BANNER_TYPES, BANNER_THEMES, cleanBannerLink, type AutoBannerType, type BannerTheme } from "@/lib/home-banners-utils";

const MISSING = "Home banners need database migrations 0108 and 0109. Run them in the Supabase SQL editor, then try again.";
const missing = (code?: string) => code === "42P01" || code === "42703" || code === "PGRST204" || code === "PGRST205";

export interface BannerInput {
  id?: string;
  kind: "custom" | "auto";
  autoType: AutoBannerType | null;
  eyebrow: string;
  title: string;
  titleAr: string;
  subtitle: string;
  subtitleAr: string;
  ctaLabel: string;
  ctaLabelAr: string;
  linkUrl: string;
  theme: BannerTheme;
  imageUrl: string | null;
  photos: string[];
  /** Local date-time boxes, already converted to ISO by the caller; null = no limit. */
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
}

function refresh() {
  revalidatePath("/admin/banners");
  revalidatePath("/");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = async () => (await createClient()) as any;

export async function saveBanner(input: BannerInput): Promise<{ error?: string }> {
  try {
    const auto = input.kind === "auto";
    const title = input.title.trim();
    if (auto && !AUTO_BANNER_TYPES.some((t) => t.value === input.autoType)) return await { error: "Choose which automatic banner this is." };
    if (!auto && !title) return await { error: "Give the banner a title." };
    if (!BANNER_THEMES.some((t) => t.value === input.theme)) return await { error: "Choose a colour." };
    const link = cleanBannerLink(input.linkUrl);
    if (link === null) return await { error: "The link must start with / (a page of the shop), # (a place on the home page) or https://." };
    const cta = input.ctaLabel.trim();
    if (!auto && cta && !link) return await { error: "Add a link for the button, or clear the button text." };
    if (input.startsAt && input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) return await { error: "The end is before the start." };
    const photos = input.photos.filter(Boolean).slice(0, 4);

    const row = {
      kind: auto ? "auto" : "custom",
      auto_type: auto ? input.autoType : null,
      eyebrow: input.eyebrow.trim() || null,
      title: title || null,
      title_ar: input.titleAr.trim() || null,
      subtitle: input.subtitle.trim() || null,
      subtitle_ar: input.subtitleAr.trim() || null,
      cta_label: cta || null,
      cta_label_ar: input.ctaLabelAr.trim() || null,
      link_url: link || null,
      theme: input.theme,
      // An automatic banner keeps the live slide's own colour and photos.
      image_url: auto ? null : input.imageUrl || null,
      photos: auto ? [] : photos,
      starts_at: input.startsAt ? new Date(input.startsAt).toISOString() : null,
      ends_at: input.endsAt ? new Date(input.endsAt).toISOString() : null,
      is_active: input.isActive,
      updated_at: new Date().toISOString(),
    };
    const supabase = await db();
    let error;
    if (input.id) ({ error } = await supabase.from("home_banners").update(row).eq("id", input.id));
    else {
      // A new banner goes to the end of the slider.
      const { data: last } = await supabase.from("home_banners").select("sort_order").order("sort_order", { ascending: false }).limit(1);
      ({ error } = await supabase.from("home_banners").insert({ ...row, sort_order: ((last?.[0]?.sort_order as number | undefined) ?? -1) + 1 }));
    }
    if (error) return await { error: missing(error.code) ? MISSING : friendlyMessage(error) };
    refresh();
    return await {};
  } catch (e) {
    return failure(e) as never;
  }
}

export async function setBannerActive(id: string, active: boolean): Promise<{ error?: string }> {
  try {
    const { error } = await (await db()).from("home_banners").update({ is_active: active, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return await { error: friendlyMessage(error) };
    refresh();
    return await {};
  } catch (e) {
    return failure(e) as never;
  }
}

export async function deleteBanner(id: string): Promise<{ error?: string }> {
  try {
    const { error } = await (await db()).from("home_banners").delete().eq("id", id);
    if (error) return await { error: friendlyMessage(error) };
    refresh();
    return await {};
  } catch (e) {
    return failure(e) as never;
  }
}

/**
 * Adds the shop's built-in slides (welcome, fresh today, deals, free delivery) as editable automatic banners, at the end of the list, so the
 * admin can reword, recolour, reorder, schedule or switch them off. Only the ones not already in the list are added.
 */
export async function addBuiltInBanners(): Promise<{ error?: string; added?: number }> {
  try {
    const supabase = await db();
    const { data: existing, error: readError } = await supabase.from("home_banners").select("auto_type, sort_order").order("sort_order", { ascending: false });
    if (readError) return await { error: missing(readError.code) ? MISSING : friendlyMessage(readError) };
    const have = new Set(((existing ?? []) as { auto_type: string | null }[]).map((b) => b.auto_type));
    let next = (((existing ?? []) as { sort_order: number }[])[0]?.sort_order ?? -1) + 1;
    const wanted: { type: AutoBannerType; theme: BannerTheme }[] = [
      { type: "welcome", theme: "blue" },
      { type: "fresh_today", theme: "green" },
      { type: "deals", theme: "orange" },
      { type: "free_delivery", theme: "teal" },
    ];
    const rows = wanted.filter((w) => !have.has(w.type)).map((w) => ({ kind: "auto", auto_type: w.type, theme: w.theme, photos: [], sort_order: next++, is_active: true }));
    if (rows.length === 0) return await { added: 0 };
    const { error } = await supabase.from("home_banners").insert(rows);
    if (error) return await { error: friendlyMessage(error) };
    refresh();
    return await { added: rows.length };
  } catch (e) {
    return failure(e) as never;
  }
}

/** Saves the slider order: the ids in the order they should appear. */
export async function reorderBanners(ids: string[]): Promise<{ error?: string }> {
  try {
    const supabase = await db();
    const results = await Promise.all(ids.map((id, i) => supabase.from("home_banners").update({ sort_order: i }).eq("id", id)));
    const failed = results.find((r: { error?: unknown }) => r.error);
    if (failed) return await { error: friendlyMessage(failed.error) };
    refresh();
    return await {};
  } catch (e) {
    return failure(e) as never;
  }
}

"use server";

import { failure, friendlyMessage } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { BANNER_THEMES, cleanBannerLink, type BannerTheme } from "@/lib/home-banners-utils";

const MISSING = "Home banners need database migration 0108. Run it in the Supabase SQL editor, then try again.";
const missing = (code?: string) => code === "42P01" || code === "42703" || code === "PGRST204" || code === "PGRST205";

export interface BannerInput {
  id?: string;
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
    const title = input.title.trim();
    if (!title) return await { error: "Give the banner a title." };
    if (!BANNER_THEMES.some((t) => t.value === input.theme)) return await { error: "Choose a colour." };
    const link = cleanBannerLink(input.linkUrl);
    if (link === null) return await { error: "The link must start with / (a page of the shop), # (a place on the home page) or https://." };
    const cta = input.ctaLabel.trim();
    if (cta && !link) return await { error: "Add a link for the button, or clear the button text." };
    if (input.startsAt && input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) return await { error: "The end is before the start." };
    const photos = input.photos.filter(Boolean).slice(0, 4);

    const row = {
      eyebrow: input.eyebrow.trim() || null,
      title,
      title_ar: input.titleAr.trim() || null,
      subtitle: input.subtitle.trim() || null,
      subtitle_ar: input.subtitleAr.trim() || null,
      cta_label: cta || null,
      cta_label_ar: input.ctaLabelAr.trim() || null,
      link_url: link || null,
      theme: input.theme,
      image_url: input.imageUrl || null,
      photos,
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

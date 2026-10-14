"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import FormDialog, { DialogSection } from "@/components/ui/FormDialog";
import ImageUploader from "@/components/ImageUploader";
import ArabicInput from "@/components/ui/ArabicInput";
import Select from "@/components/ui/Select";
import { Field, inputClass, primaryButton } from "@/components/ui/Form";
import { useDialogs } from "@/components/ui/Dialogs";
import { unwrapAction } from "@/lib/errors";
import { deleteBanner, reorderBanners, saveBanner, setBannerActive } from "@/lib/actions/admin-banners";
import BannerPreview from "@/components/admin/BannerPreview";
import type { HeroSlide } from "@/components/HomeHero";
import { AUTO_BANNER_TYPES, BANNER_THEMES, bannerSlide, bannerStatus, type AutoBannerType, type BannerRow, type BannerStatus, type BannerTheme } from "@/lib/home-banners-utils";

const STATUS_LABEL: Record<BannerStatus, string> = { live: "Live", scheduled: "Scheduled", ended: "Ended", off: "Switched off" };
const STATUS_STYLE: Record<BannerStatus, string> = { live: "bg-emerald-50 text-emerald-700", scheduled: "bg-sky-50 text-sky-700", ended: "bg-neutral-100 text-neutral-500", off: "bg-amber-50 text-amber-700" };
const SWATCH: Record<BannerTheme, string> = { blue: "bg-brand-600", green: "bg-emerald-600", orange: "bg-orange-500", teal: "bg-teal-600" };

/** An ISO time as the value of a datetime-local box (the viewer's own clock). */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);
const dateText = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null);

type AutoSlides = Record<AutoBannerType, HeroSlide | null>;

interface Draft {
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
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}
const blank: Draft = { kind: "custom", autoType: null, eyebrow: "", title: "", titleAr: "", subtitle: "", subtitleAr: "", ctaLabel: "", ctaLabelAr: "", linkUrl: "", theme: "blue", imageUrl: null, photos: [], startsAt: "", endsAt: "", isActive: true };

const draftOf = (b: BannerRow): Draft => ({
  id: b.id,
  kind: b.kind,
  autoType: b.auto_type,
  eyebrow: b.eyebrow ?? "",
  title: b.title ?? "",
  titleAr: b.title_ar ?? "",
  subtitle: b.subtitle ?? "",
  subtitleAr: b.subtitle_ar ?? "",
  ctaLabel: b.cta_label ?? "",
  ctaLabelAr: b.cta_label_ar ?? "",
  linkUrl: b.link_url ?? "",
  theme: b.theme,
  imageUrl: b.image_url,
  photos: b.photos ?? [],
  startsAt: toLocalInput(b.starts_at),
  endsAt: toLocalInput(b.ends_at),
  isActive: b.is_active,
});

const ghostButton = "h-8 rounded-full border border-neutral-300 px-3 text-xs font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50";

const autoLabel = (t: AutoBannerType | null) => AUTO_BANNER_TYPES.find((x) => x.value === t)?.label ?? "Automatic";

export default function BannersManager({ banners, autoSlides, disabled }: { banners: BannerRow[]; autoSlides: AutoSlides; disabled: boolean }) {
  const router = useRouter();
  const { confirm: ask } = useDialogs();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function act(fn: () => Promise<{ error?: string }>, ok: string) {
    setMessage(null);
    start(async () => {
      const res = await fn();
      if (res.error) setMessage({ ok: false, text: res.error });
      else {
        setMessage({ ok: true, text: ok });
        router.refresh();
      }
    });
  }

  function move(i: number, dir: -1 | 1) {
    const ids = banners.map((b) => b.id);
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    act(() => unwrapAction(reorderBanners)(ids), "Order saved.");
  }

  const liveCount = banners.filter((b) => bannerStatus(b) === "live").length;

  return (
    <div className="flex flex-col gap-4">
      {message && (
        <p role="status" className={`rounded-xl border px-3 py-2 text-sm font-medium ${message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
          {message.text}
        </p>
      )}

      <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 p-3 sm:p-4">
          <p className="text-sm text-neutral-600">
            {banners.length === 0 ? "The shop shows its built-in slides." : liveCount > 0 ? <><b>{liveCount}</b> live. Shoppers see these instead of the built-in slides.</> : "None is live right now, so the shop shows its built-in slides."}
          </p>
          <button type="button" disabled={disabled} onClick={() => setEditing({ ...blank })} className={primaryButton}>
            + New banner
          </button>
        </div>

        {banners.length === 0 ? (
          <p className="p-10 text-center text-sm text-neutral-500">No banners yet. Add one to replace the built-in slides.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {banners.map((b, i) => {
              const st = bannerStatus(b);
              const liveSlide = b.kind === "auto" && b.auto_type ? autoSlides[b.auto_type] : null;
              const idle = b.kind === "auto" && !liveSlide;
              const thumb = b.kind === "auto" ? liveSlide?.images[0]?.src : b.image_url ?? b.photos?.[0];
              return (
                <li key={b.id} className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:px-4">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex shrink-0 flex-col">
                      <button type="button" aria-label="Move up" disabled={pending || i === 0} onClick={() => move(i, -1)} className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 disabled:opacity-30">▲</button>
                      <button type="button" aria-label="Move down" disabled={pending || i === banners.length - 1} onClick={() => move(i, 1)} className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 disabled:opacity-30">▼</button>
                    </div>
                    <div className={`flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg ${SWATCH[b.theme]}`}>
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span aria-hidden className="text-xl text-white">🖼️</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-neutral-900">{b.title || liveSlide?.title || autoLabel(b.auto_type)}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[st]}`}>{STATUS_LABEL[st]}</span>
                        {b.kind === "auto" && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700">Auto · {autoLabel(b.auto_type)}</span>}
                        {idle && st === "live" && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">Nothing to show now</span>}
                        <span>{b.starts_at || b.ends_at ? `${dateText(b.starts_at) ?? "now"} → ${dateText(b.ends_at) ?? "no end"}` : "Always"}</span>
                        {b.link_url && <span className="max-w-[12rem] truncate font-mono">{b.link_url}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:justify-end">
                    <button type="button" disabled={pending} onClick={() => setEditing(draftOf(b))} className={ghostButton}>Edit</button>
                    <button type="button" disabled={pending} onClick={() => act(() => unwrapAction(setBannerActive)(b.id, !b.is_active), b.is_active ? "Banner switched off." : "Banner switched on.")} className={ghostButton}>
                      {b.is_active ? "Switch off" : "Switch on"}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={async () => (await ask({ title: `Delete "${b.title}"?`, message: "It is removed from the shop home page.", confirmLabel: "Delete banner", danger: true })) && act(() => unwrapAction(deleteBanner)(b.id), "Banner deleted.")}
                      className="h-8 rounded-full border border-neutral-300 px-3 text-xs font-bold text-neutral-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {editing && (
        <BannerDialog
          draft={editing}
          autoSlides={autoSlides}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setMessage({ ok: true, text: "Banner saved." });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function BannerDialog({ draft, autoSlides, onClose, onSaved }: { draft: Draft; autoSlides: AutoSlides; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(draft);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  async function save(): Promise<string | void> {
    const res = await unwrapAction(saveBanner)({ ...d, startsAt: fromLocalInput(d.startsAt), endsAt: fromLocalInput(d.endsAt) });
    if (res.error) return res.error;
    onSaved();
  }

  const auto = d.kind === "auto";
  const base = auto && d.autoType ? autoSlides[d.autoType] : null;
  // What the shop would show for this draft right now, built with the same code the home page uses.
  const preview =
    auto && !base
      ? null
      : bannerSlide(
          { id: "preview", kind: d.kind, auto_type: d.autoType, eyebrow: d.eyebrow, title: d.title, title_ar: null, subtitle: d.subtitle, subtitle_ar: null, cta_label: d.ctaLabel, cta_label_ar: null, link_url: d.linkUrl, theme: d.theme, image_url: d.imageUrl, photos: d.photos, sort_order: 0, starts_at: null, ends_at: null, is_active: true },
          false,
          autoSlides,
        );

  return (
    <FormDialog size="xl" icon="🖼️" title={d.id ? "Edit banner" : "New banner"} subtitle="A slide on the shop home page" saveLabel={d.id ? "Save changes" : "Add banner"} onClose={onClose} onSave={save}>
      <DialogSection title="Preview" hint="How the slide looks on a phone and on a computer. It updates as you type." cols={1}>
        <BannerPreview slide={preview} />
      </DialogSection>

      <DialogSection title="Type" cols={1}>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { kind: "custom" as const, title: "Custom", hint: "Your own text, colour and pictures." },
            { kind: "auto" as const, title: "Automatic", hint: "Built from live shop data, so it stays up to date." },
          ].map((o) => (
            <button key={o.kind} type="button" onClick={() => set("kind", o.kind)} className={`rounded-xl border p-3 text-start transition ${d.kind === o.kind ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-neutral-200 hover:border-neutral-300"}`}>
              <span className="block text-sm font-bold text-neutral-900">{o.title}</span>
              <span className="block text-xs text-neutral-500">{o.hint}</span>
            </button>
          ))}
        </div>
        {auto && (
          <Field label="Automatic banner" required hint={AUTO_BANNER_TYPES.find((x) => x.value === d.autoType)?.hint ?? "Photos, title and numbers come from the live shop. Anything you fill in below replaces the automatic wording."}>
            <Select value={d.autoType ?? ""} onChange={(e) => set("autoType", (e.target.value || null) as AutoBannerType | null)} className="w-full">
              <option value="">Choose…</option>
              {AUTO_BANNER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </DialogSection>

      <DialogSection title={auto ? "Wording" : "Text"} hint={auto ? "Leave a field empty to use the automatic wording." : undefined}>
        <Field label="Title" required={!auto} className="sm:col-span-2">
          <input value={d.title} onChange={(e) => set("title", e.target.value)} placeholder={base?.title ?? "e.g. Fresh vegetables, delivered today"} className={inputClass} />
        </Field>
        <Field label="Title in Arabic" className="sm:col-span-2">
          <ArabicInput english={d.title || base?.title || ""} value={d.titleAr} onChange={(v) => set("titleAr", v)} className={inputClass} compact />
        </Field>
        <Field label="Small line above the title" hint="Optional, for example a season or a promotion name." className="sm:col-span-2">
          <input value={d.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} placeholder={base?.eyebrow} className={inputClass} />
        </Field>
        <Field label="Subtitle" hint="Shown on larger screens.">
          <input value={d.subtitle} onChange={(e) => set("subtitle", e.target.value)} placeholder={base?.subtitle} className={inputClass} />
        </Field>
        <Field label="Subtitle in Arabic">
          <ArabicInput english={d.subtitle} value={d.subtitleAr} onChange={(v) => set("subtitleAr", v)} className={inputClass} compact />
        </Field>
      </DialogSection>

      <DialogSection title="Button" hint="Leave the button text empty for a banner without a button.">
        <Field label="Button text">
          <input value={d.ctaLabel} onChange={(e) => set("ctaLabel", e.target.value)} placeholder={base?.cta ?? "Shop now"} className={inputClass} />
        </Field>
        <Field label="Button text in Arabic">
          <ArabicInput english={d.ctaLabel} value={d.ctaLabelAr} onChange={(v) => set("ctaLabelAr", v)} className={inputClass} compact />
        </Field>
        <Field label="Link" hint="A page like /categories/dairy, a place on the home page like #offers, or a full https:// address." className="sm:col-span-2">
          <input value={d.linkUrl} onChange={(e) => set("linkUrl", e.target.value)} placeholder={base?.href ?? "#offers"} className={inputClass} />
        </Field>
      </DialogSection>

      {!auto && (
      <DialogSection title="Look" hint="Use one picture over the whole banner, or a few small photos beside the text. Both can be left empty.">
        <Field label="Colour">
          <Select value={d.theme} onChange={(e) => set("theme", e.target.value as BannerTheme)} className="w-full">
            {BANNER_THEMES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Banner picture" hint="A wide picture across the whole banner. Keep the left side calm so the text stays readable." className="sm:col-span-2">
          <ImageUploader value={d.imageUrl} onChange={(u) => set("imageUrl", u)} alt="Banner" emoji="🖼️" wide />
        </Field>
        <Field label="Photos beside the text" hint="Up to four. Used when there is no banner picture." className="sm:col-span-2">
          <div className="flex flex-col gap-3">
            {d.photos.map((p, i) => (
              <ImageUploader key={p + i} value={p} onChange={(u) => set("photos", u ? d.photos.map((x, j) => (j === i ? u : x)) : d.photos.filter((_, j) => j !== i))} alt={`Photo ${i + 1}`} />
            ))}
            {d.photos.length < 4 && <ImageUploader key={`new-${d.photos.length}`} value={null} onChange={(u) => u && set("photos", [...d.photos, u])} alt="New photo" />}
          </div>
        </Field>
      </DialogSection>
      )}

      <DialogSection title="Schedule" hint="Leave both empty to show it whenever it is switched on.">
        <Field label="Starts">
          <input type="datetime-local" value={d.startsAt} onChange={(e) => set("startsAt", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Ends">
          <input type="datetime-local" value={d.endsAt} onChange={(e) => set("endsAt", e.target.value)} className={inputClass} />
        </Field>
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-800 sm:col-span-2">
          <input type="checkbox" checked={d.isActive} onChange={(e) => set("isActive", e.target.checked)} className="h-4 w-4 rounded border-neutral-300 accent-brand-700" />
          Switched on
        </label>
      </DialogSection>
    </FormDialog>
  );
}

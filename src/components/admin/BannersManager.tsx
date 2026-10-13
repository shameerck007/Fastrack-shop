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
import { BANNER_THEMES, bannerStatus, type BannerRow, type BannerStatus, type BannerTheme } from "@/lib/home-banners-utils";

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

interface Draft {
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
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}
const blank: Draft = { eyebrow: "", title: "", titleAr: "", subtitle: "", subtitleAr: "", ctaLabel: "", ctaLabelAr: "", linkUrl: "", theme: "blue", imageUrl: null, photos: [], startsAt: "", endsAt: "", isActive: true };

const draftOf = (b: BannerRow): Draft => ({
  id: b.id,
  eyebrow: b.eyebrow ?? "",
  title: b.title,
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

export default function BannersManager({ banners, disabled }: { banners: BannerRow[]; disabled: boolean }) {
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

  const live = banners.filter((b) => bannerStatus(b) === "live").length;

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
            {banners.length === 0 ? "The shop shows its built-in slides." : live > 0 ? <><b>{live}</b> live. Shoppers see these instead of the built-in slides.</> : "None is live right now, so the shop shows its built-in slides."}
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
              const thumb = b.image_url ?? b.photos?.[0];
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
                      <p className="truncate text-sm font-bold text-neutral-900">{b.title}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[st]}`}>{STATUS_LABEL[st]}</span>
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

function BannerDialog({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(draft);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  async function save(): Promise<string | void> {
    const res = await unwrapAction(saveBanner)({ ...d, startsAt: fromLocalInput(d.startsAt), endsAt: fromLocalInput(d.endsAt) });
    if (res.error) return res.error;
    onSaved();
  }

  return (
    <FormDialog icon="🖼️" title={d.id ? "Edit banner" : "New banner"} subtitle="A slide on the shop home page" saveLabel={d.id ? "Save changes" : "Add banner"} onClose={onClose} onSave={save}>
      <DialogSection title="Text">
        <Field label="Title" required className="sm:col-span-2">
          <input value={d.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Fresh vegetables, delivered today" className={inputClass} />
        </Field>
        <Field label="Title in Arabic" className="sm:col-span-2">
          <ArabicInput english={d.title} value={d.titleAr} onChange={(v) => set("titleAr", v)} className={inputClass} compact />
        </Field>
        <Field label="Small line above the title" hint="Optional, for example a season or a promotion name." className="sm:col-span-2">
          <input value={d.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Subtitle" hint="Shown on larger screens.">
          <input value={d.subtitle} onChange={(e) => set("subtitle", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Subtitle in Arabic">
          <ArabicInput english={d.subtitle} value={d.subtitleAr} onChange={(v) => set("subtitleAr", v)} className={inputClass} compact />
        </Field>
      </DialogSection>

      <DialogSection title="Button" hint="Leave the button text empty for a banner without a button.">
        <Field label="Button text">
          <input value={d.ctaLabel} onChange={(e) => set("ctaLabel", e.target.value)} placeholder="Shop now" className={inputClass} />
        </Field>
        <Field label="Button text in Arabic">
          <ArabicInput english={d.ctaLabel} value={d.ctaLabelAr} onChange={(v) => set("ctaLabelAr", v)} className={inputClass} compact />
        </Field>
        <Field label="Link" hint="A page like /categories/dairy, a place on the home page like #offers, or a full https:// address." className="sm:col-span-2">
          <input value={d.linkUrl} onChange={(e) => set("linkUrl", e.target.value)} placeholder="#offers" className={inputClass} />
        </Field>
      </DialogSection>

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

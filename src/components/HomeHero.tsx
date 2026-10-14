"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface HeroImage {
  src: string;
  alt: string;
}

export interface HeroSlide {
  id: string;
  theme: "blue" | "green" | "orange" | "teal";
  eyebrow: string;
  title: string;
  subtitle: string;
  chips?: string[];
  cta: string;
  href: string;
  /** Product photos for the collage. */
  images: HeroImage[];
  /** A big emoji drawn behind the collage (for example the scooter). */
  art?: string;
  /** One picture across the whole slide (admin banners). Replaces the collage. */
  cover?: string;
}

export interface HeroTile {
  id: string;
  title: string;
  cta: string;
  href: string;
  theme: "orange" | "green";
  images: HeroImage[];
}

const THEME: Record<HeroSlide["theme"], { bg: string; eyebrow: string; title: string; chip: string; cta: string; blob1: string; blob2: string }> = {
  blue: { bg: "from-brand-50 via-brand-100 to-brand-200", eyebrow: "text-brand-700", title: "text-brand-950", chip: "text-brand-800", cta: "bg-brand-700 hover:bg-brand-800", blob1: "bg-brand-300/50", blob2: "bg-white/60" },
  green: { bg: "from-emerald-50 via-emerald-100 to-lime-200", eyebrow: "text-emerald-700", title: "text-emerald-950", chip: "text-emerald-800", cta: "bg-emerald-700 hover:bg-emerald-800", blob1: "bg-emerald-300/50", blob2: "bg-white/60" },
  orange: { bg: "from-amber-50 via-orange-100 to-rose-200", eyebrow: "text-orange-700", title: "text-rose-950", chip: "text-orange-800", cta: "bg-rose-600 hover:bg-rose-700", blob1: "bg-orange-300/50", blob2: "bg-white/60" },
  teal: { bg: "from-cyan-50 via-teal-100 to-sky-200", eyebrow: "text-teal-700", title: "text-teal-950", chip: "text-teal-800", cta: "bg-teal-700 hover:bg-teal-800", blob1: "bg-teal-300/50", blob2: "bg-white/60" },
};

const TILT = ["-rotate-3", "rotate-3", "rotate-2", "-rotate-2"];

/** Up to four tiles in a neat staggered 2 x 2: photos, with the slide's big emoji as one tile when it has one. */
function Collage({ images, art }: { images: HeroImage[]; art?: string }) {
  const tiles: ({ kind: "img"; img: HeroImage } | { kind: "art"; art: string })[] = images.slice(0, art ? 3 : 4).map((img) => ({ kind: "img" as const, img }));
  if (art) tiles.splice(Math.min(1, tiles.length), 0, { kind: "art", art });
  return (
    <div aria-hidden className="pointer-events-none absolute end-3 top-1/2 grid -translate-y-1/2 grid-cols-2 gap-2.5 sm:end-8 sm:gap-4 lg:end-12">
      {tiles.map((t, i) => {
        const size = "h-[3.7rem] w-[3.7rem] sm:h-28 sm:w-28 lg:h-36 lg:w-36";
        const pos = `${i % 2 === 1 ? "translate-y-4 sm:translate-y-6" : "-translate-y-1 sm:-translate-y-2"} ${TILT[i]}`;
        return t.kind === "art" ? (
          <span key="art" className={`flex items-center justify-center rounded-2xl border-4 border-white bg-white/70 text-4xl shadow-xl backdrop-blur sm:text-6xl lg:text-7xl ${size} ${pos}`}>
            {t.art}
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={t.img.src + i} src={t.img.src} alt="" loading={i === 0 ? "eager" : "lazy"} className={`rounded-2xl border-4 border-white bg-white object-cover shadow-xl ${size} ${pos}`} />
        );
      })}
    </div>
  );
}

export function Slide({ s, active }: { s: HeroSlide; active: boolean }) {
  const th = THEME[s.theme];
  return (
    <div className={`relative min-h-[236px] w-full shrink-0 snap-center overflow-hidden bg-gradient-to-br ${th.bg} px-4 pb-10 pt-5 sm:min-h-[300px] sm:px-10 sm:py-10`} aria-hidden={!active}>
      <span aria-hidden className={`absolute -end-10 -top-14 h-52 w-52 rounded-full ${th.blob1}`} />
      <span aria-hidden className={`absolute -bottom-20 end-1/3 h-44 w-44 rounded-full ${th.blob2}`} />
      {s.cover ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.cover} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
          <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/60 to-transparent rtl:bg-gradient-to-l" />
        </>
      ) : (
        (s.images.length > 0 || s.art) && <Collage images={s.images} art={s.art} />
      )}

      <div className={`relative ${s.cover || (s.images.length === 0 && !s.art) ? "max-w-[85%] sm:max-w-[60%]" : "max-w-[60%] sm:max-w-[44%]"}`}>
        {s.eyebrow && <p className={`mb-1 truncate text-[11px] font-bold uppercase tracking-wider sm:text-xs ${th.eyebrow}`}>{s.eyebrow}</p>}
        <h2 className={`text-[1.2rem] font-extrabold leading-[1.15] tracking-tight sm:text-4xl lg:text-[2.6rem] ${th.title}`}>{s.title}</h2>
        {s.subtitle && <p className="mt-2 hidden text-sm text-neutral-700 sm:block sm:text-base">{s.subtitle}</p>}
        {s.chips && s.chips.length > 0 && (
          <div className="mt-3 hidden flex-wrap gap-2 sm:flex">
            {s.chips.map((c) => (
              <span key={c} className={`rounded-full bg-white/90 px-3 py-1 text-xs font-semibold shadow-sm ${th.chip}`}>
                {c}
              </span>
            ))}
          </div>
        )}
        {s.cta && s.href && (
          <a href={s.href} tabIndex={active ? 0 : -1} className={`mt-3 inline-flex h-9 items-center whitespace-nowrap rounded-full px-4 text-[13px] font-bold text-white shadow-md transition active:scale-95 sm:mt-5 sm:h-11 sm:px-7 sm:text-sm ${th.cta}`}>
            {s.cta} <span aria-hidden className="ms-1.5 rtl:-scale-x-100">→</span>
          </a>
        )}
      </div>
    </div>
  );
}

function PromoTile({ t }: { t: HeroTile }) {
  const orange = t.theme === "orange";
  return (
    <a href={t.href} className={`group relative flex min-h-[140px] flex-1 flex-col justify-between overflow-hidden rounded-3xl p-4 shadow-sm ring-1 transition hover:shadow-md ${orange ? "bg-gradient-to-br from-amber-50 to-orange-100 ring-orange-100" : "bg-gradient-to-br from-emerald-50 to-lime-100 ring-emerald-100"}`}>
      <p className={`relative z-10 max-w-[60%] text-base font-extrabold leading-tight ${orange ? "text-rose-950" : "text-emerald-950"}`}>{t.title}</p>
      <span className={`relative z-10 mt-2 inline-flex w-fit items-center text-xs font-bold ${orange ? "text-rose-700" : "text-emerald-700"}`}>
        {t.cta} <span aria-hidden className="ms-1 transition group-hover:translate-x-0.5 rtl:-scale-x-100">→</span>
      </span>
      <div aria-hidden className="absolute -end-2 top-3 grid w-[46%] grid-cols-2 gap-1.5">
        {t.images.slice(0, 4).map((img, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={img.src + i} src={img.src} alt="" loading="lazy" className="aspect-square w-full rounded-xl border-2 border-white bg-white object-cover shadow" />
        ))}
      </div>
    </a>
  );
}

/** The top of the shop home page: a carousel of graphic banners (auto-advancing, swipeable) and two promo tiles beside it on large screens. */
export default function HomeHero({ slides, tiles }: { slides: HeroSlide[]; tiles: HeroTile[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback((i: number) => {
    const el = scroller.current;
    if (!el) return;
    const n = (i + slides.length) % slides.length;
    el.scrollTo({ left: n * el.clientWidth * (document.dir === "rtl" ? -1 : 1), behavior: "smooth" });
    setIndex(n);
  }, [slides.length]);

  // Keep the dots in step when the shopper swipes.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(t);
      t = setTimeout(() => setIndex(Math.round(Math.abs(el.scrollLeft) / Math.max(1, el.clientWidth))), 80);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      clearTimeout(t);
    };
  }, []);

  // Auto-advance, unless the shopper is touching or hovering, or prefers less motion.
  useEffect(() => {
    if (paused || slides.length < 2) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => go(index + 1), 5500);
    return () => clearInterval(id);
  }, [paused, index, go, slides.length]);

  return (
    <section className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]" aria-roledescription="carousel" aria-label="Featured offers">
      <div className="relative overflow-hidden rounded-3xl shadow-sm ring-1 ring-black/5" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onTouchStart={() => setPaused(true)} onTouchEnd={() => setPaused(false)}>
        <div ref={scroller} className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {slides.map((s, i) => (
            <Slide key={s.id} s={s} active={i === index} />
          ))}
        </div>

        {slides.length > 1 && (
          <>
            <button onClick={() => go(index - 1)} aria-label="Previous banner" className="absolute start-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-lg text-neutral-800 shadow-md transition hover:bg-white sm:flex rtl:rotate-180">
              ‹
            </button>
            <button onClick={() => go(index + 1)} aria-label="Next banner" className="absolute end-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-lg text-neutral-800 shadow-md transition hover:bg-white sm:flex rtl:rotate-180">
              ›
            </button>
            <div className="absolute inset-x-0 bottom-2.5 flex justify-center gap-1" role="tablist" aria-label="Choose a banner">
              {slides.map((s, i) => (
                <button key={s.id} role="tab" aria-selected={i === index} aria-label={`Banner ${i + 1}`} onClick={() => go(i)} className="flex h-6 items-center px-1">
                  <span className={`block h-2 rounded-full transition-all ${i === index ? "w-6 bg-neutral-900/70" : "w-2 bg-neutral-900/25"}`} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {tiles.length > 0 && <div className="hidden flex-col gap-4 lg:flex">{tiles.map((t) => <PromoTile key={t.id} t={t} />)}</div>}
    </section>
  );
}

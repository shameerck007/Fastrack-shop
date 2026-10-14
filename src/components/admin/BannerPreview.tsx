"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Slide, type HeroSlide } from "@/components/HomeHero";

/**
 * The real shop slide inside a frame of a given width. The slide's layout follows the width of the screen it is on, so each frame is a small
 * document of its own (with the page's styles copied in) and the slide is drawn into it; the frame is then scaled down to fit the space.
 */
function SlideFrame({ slide, width, height, label }: { slide: HeroSlide; width: number; height: number; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / width));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  // The frame's document is written once, with the page's own styles in it, so it loads in one step and the slide is drawn into its root when it has.
  const [srcDoc] = useState(() => {
    if (typeof document === "undefined") return "";
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).map((n) => n.outerHTML).join("");
    return `<!doctype html><html dir="${document.dir}" class="${document.documentElement.className}"><head><meta charset="utf-8">${styles}</head><body style="margin:0;background:transparent"><div id="root"></div></body></html>`;
  });
  const setup = useCallback(() => {
    setMount(frame.current?.contentDocument?.getElementById("root") ?? null);
  }, []);

  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500">{label}</p>
      <div ref={box} className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50" style={{ height: height * scale }}>
        <iframe ref={frame} srcDoc={srcDoc} onLoad={setup} title={label} tabIndex={-1} className="block border-0" style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }} />
        {mount && createPortal(<div onClickCapture={(e) => e.preventDefault()}><Slide s={slide} active /></div>, mount)}
      </div>
    </div>
  );
}

/** The slide as it will look on a phone (375 px wide) and on a computer, updating as the fields change. */
export default function BannerPreview({ slide }: { slide: HeroSlide | null }) {
  if (!slide) return <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">This automatic banner has nothing to show right now, so the shop skips it (for example no photos yet, or free delivery is off).</p>;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <SlideFrame slide={slide} width={375} height={250} label="Phone (375 px)" />
      <SlideFrame slide={slide} width={880} height={310} label="Computer" />
    </div>
  );
}

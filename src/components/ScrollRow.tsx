"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * One horizontal line that can be moved: swipe on a phone, drag with the mouse or use the arrow buttons on a computer.
 * Nothing wraps onto a second line; the row simply scrolls.
 */
export default function ScrollRow({ children, className = "", innerClassName = "" }: { children: ReactNode; className?: string; innerClassName?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const pos = Math.abs(el.scrollLeft);
    setEdges({ start: pos > 4, end: pos < max - 4 });
  }, []);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, children]);

  function scrollBy(dir: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollBy({ left: dir * (rtl ? -1 : 1) * el.clientWidth * 0.8, behavior: "smooth" });
  }

  const arrow = "absolute top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-lg font-bold text-neutral-700 shadow-md ring-1 ring-neutral-200 hover:bg-blue-50 md:flex";

  return (
    <div className={`group/row relative ${className}`}>
      {edges.start && (
        <button type="button" aria-label="Scroll back" onClick={() => scrollBy(-1)} className={`${arrow} start-1`}>
          ‹
        </button>
      )}
      <div
        ref={ref}
        onScroll={measure}
        onDragStart={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") return;
          drag.current = { x: e.clientX, left: ref.current?.scrollLeft ?? 0, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          const el = ref.current;
          if (!d || !el) return;
          const dx = e.clientX - d.x;
          if (Math.abs(dx) > 4) d.moved = true;
          if (d.moved) el.scrollLeft = d.left - dx;
        }}
        onPointerUp={() => {
          // A drag must not count as a click on the tile under the pointer.
          if (drag.current?.moved) {
            const swallow = (ev: Event) => {
              ev.stopPropagation();
              ev.preventDefault();
            };
            window.addEventListener("click", swallow, { capture: true, once: true });
            setTimeout(() => window.removeEventListener("click", swallow, true), 0);
          }
          drag.current = null;
        }}
        onPointerLeave={() => {
          drag.current = null;
        }}
        className={`no-scrollbar flex snap-x scroll-px-4 flex-nowrap overflow-x-auto md:cursor-grab md:active:cursor-grabbing ${innerClassName}`}
      >
        {children}
      </div>
      {edges.end && (
        <button type="button" aria-label="Scroll forward" onClick={() => scrollBy(1)} className={`${arrow} end-1`}>
          ›
        </button>
      )}
    </div>
  );
}

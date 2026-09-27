"use client";

import { useEffect } from "react";

const SIZES = {
  md: "max-w-lg",
  xl: "max-w-4xl",
};

export default function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: keyof typeof SIZES;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    // z-[2000]: Leaflet's own layers (tooltip pane 650, popup pane 700,
    // zoom controls 1000) sit above Tailwind's z-50, so any map rendered on
    // the page behind this modal would otherwise show through on top of it.
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative flex max-h-[90vh] w-full ${SIZES[size]} flex-col overflow-hidden rounded-2xl bg-white shadow-2xl`}>
        {title && (
          <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-5 py-4">
            <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            >
              ✕
            </button>
          </div>
        )}
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

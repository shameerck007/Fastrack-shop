"use client";


import { errorText } from "@/lib/errors";
import { useState, useTransition } from "react";
import Modal from "@/components/Modal";
import { primaryButton, secondaryButton } from "@/components/ui/Form";

/**
 * The one popup every form in the portals uses: a header with an icon, title and a close button, the fields in the middle,
 * and a footer that stays in view with Cancel and Save. `onSave` throws (or returns an error text) to keep the popup open.
 */
export default function FormDialog({
  title,
  subtitle,
  icon = "✏️",
  size = "md",
  saveLabel = "Save changes",
  onClose,
  onSave,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  size?: "md" | "xl";
  saveLabel?: string;
  onClose: () => void;
  onSave: () => Promise<string | void>;
  children: React.ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    start(async () => {
      try {
        const res = await onSave();
        if (typeof res === "string" && res) setError(res);
        else onClose();
      } catch (e) {
        setError(errorText(e, "Could not save. Please try again."));
      }
    });
  }

  return (
    <Modal open onClose={onClose} size={size}>
      <form
        className="-m-5 flex flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="flex items-center gap-3 border-b border-neutral-100 bg-white px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-sm ring-1 ring-neutral-200">{icon}</span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-extrabold tracking-tight text-neutral-900">{title}</h2>
            {subtitle && <p className="truncate text-xs text-neutral-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700">
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-4 bg-neutral-50 p-4 sm:p-5">{children}</div>
        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 bg-white px-5 py-3">
          <p className={`min-w-0 flex-1 text-sm font-medium ${error ? "text-rose-700" : "text-neutral-500"}`}>{error ?? " "}</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={secondaryButton}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className={primaryButton}>
              {pending ? "Saving…" : saveLabel}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/** A white block inside a popup that groups related fields. */
export function DialogSection({ title, hint, children, cols = 2 }: { title?: string; hint?: string; children: React.ReactNode; cols?: 1 | 2 | 3 }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      {title && (
        <div className="mb-3">
          <h3 className="text-sm font-extrabold tracking-tight text-neutral-900">{title}</h3>
          {hint && <p className="text-xs text-neutral-500">{hint}</p>}
        </div>
      )}
      <div className={`grid gap-3 ${cols === 1 ? "" : cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>{children}</div>
    </section>
  );
}

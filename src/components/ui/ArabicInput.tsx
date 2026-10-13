"use client";


import { unwrapAction } from "@/lib/errors";
import { useEffect, useRef, useState } from "react";
import { autoTranslateToArabic } from "@/lib/actions/translate";

/**
 * An Arabic field that fills itself from the English one. While the shopkeeper has not typed in it, it follows the English text
 * (translated a moment after typing stops). As soon as they edit it, their text stays; "Translate again" brings the automatic one back.
 */
export default function ArabicInput({
  english,
  value,
  onChange,
  multiline = false,
  rows = 3,
  placeholder,
  className = "",
  required,
  compact = false,
}: {
  /** The English text this field translates. */
  english: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  className?: string;
  required?: boolean;
  /** No status line under the field (for tight rows); the retranslate button is hidden too. */
  compact?: boolean;
}) {
  // A value that is already there (editing an existing item) counts as typed by hand, so it is never overwritten by surprise.
  const [manual, setManual] = useState(value.trim() !== "");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const seq = useRef(0);
  const last = useRef("");

  async function translate(text: string, force: boolean) {
    const my = ++seq.current;
    setBusy(true);
    setNote(null);
    try {
      const out = await unwrapAction(autoTranslateToArabic)(text);
      if (my !== seq.current) return;
      if (out) {
        last.current = text;
        onChange(out);
        setManual(false);
        setNote("Translated automatically. Edit it if it needs fixing.");
      } else if (force) {
        setNote("Could not translate just now. Please type it.");
      }
    } catch {
      if (force) setNote("Could not translate just now. Please type it.");
    } finally {
      if (my === seq.current) setBusy(false);
    }
  }

  // An empty field (cleared by hand, or reset after saving) goes back to following the English text.
  useEffect(() => {
    if (value === "") {
      setManual(false);
      last.current = "";
    }
  }, [value]);

  useEffect(() => {
    const text = english.trim();
    if (manual || text.length < 2 || text === last.current) return;
    const t = setTimeout(() => void translate(text, false), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [english, manual]);

  const shared = {
    dir: "rtl" as const,
    value,
    required,
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setManual(true);
      setNote(null);
      onChange(e.target.value);
    },
    className,
  };

  return (
    <div className="flex flex-col gap-1">
      {multiline ? <textarea rows={rows} {...shared} /> : <input {...shared} />}
      {!compact && (
      <div className="flex min-h-[1.1rem] items-center justify-between gap-2 text-[11px] text-neutral-500">
        <span>{busy ? "Translating…" : note}</span>
        {english.trim().length >= 2 && (
          <button type="button" disabled={busy} onClick={() => void translate(english.trim(), true)} className="shrink-0 font-semibold text-brand-700 hover:underline disabled:opacity-50">
            ↻ Translate again
          </button>
        )}
      </div>
      )}
    </div>
  );
}

import type { ReactNode } from "react";

/** The one input look used across the app's forms (text, number, date, textarea). */
export const inputClass =
  "h-11 w-full rounded-xl border border-neutral-300 bg-white px-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400";
export const textareaClass = inputClass.replace("h-11 ", "min-h-[5.5rem] py-2.5 ");

/** A label above a control, with optional help text and an error. */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  className = "",
  children,
}: {
  label?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={htmlFor} className="text-xs font-semibold text-neutral-700">
          {label}
          {required && <span className="ms-0.5 text-blue-700">*</span>}
        </label>
      )}
      {children}
      {error ? <p className="text-xs font-medium text-blue-800">{error}</p> : hint ? <p className="text-xs text-neutral-400">{hint}</p> : null}
    </div>
  );
}

/** A titled group of fields inside a form. */
export function FormSection({ title, description, children, className = "" }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      <div className="mb-3">
        <h3 className="text-sm font-extrabold tracking-tight text-neutral-900">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-neutral-500">{description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/** The Cancel / Save row at the bottom of a form. */
export function FormActions({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-center justify-end gap-2 pt-1 ${className}`}>{children}</div>;
}

export const primaryButton =
  "inline-flex h-11 items-center justify-center rounded-full bg-blue-700 px-6 text-sm font-bold text-white transition hover:bg-blue-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
export const secondaryButton =
  "inline-flex h-11 items-center justify-center rounded-full border border-neutral-300 bg-white px-5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 active:scale-[0.98] disabled:opacity-50";

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { errorInfo } from "@/lib/errors";
import { reportError } from "@/lib/actions/report-error";

export type ErrorArea = "shop" | "admin" | "merchant" | "rider" | "warehouse";

const HOME: Record<ErrorArea, { href: string; label: string }> = {
  shop: { href: "/", label: "Go to the shop" },
  admin: { href: "/admin", label: "Back to the dashboard" },
  merchant: { href: "/merchant", label: "Back to my store" },
  rider: { href: "/rider", label: "Back to deliveries" },
  warehouse: { href: "/warehouse", label: "Back to the warehouse" },
};

/** Tells the person what happened in plain words, what they can do, and gives a reference code for support. */
export default function ErrorPanel({ error, reset, area = "shop" }: { error: Error & { digest?: string }; reset?: () => void; area?: ErrorArea }) {
  const info = useMemo(() => errorInfo(error, "We couldn't show this page just now."), [error]);
  const staff = area !== "shop";
  const [copied, setCopied] = useState(false);
  const reported = useRef(false);

  useEffect(() => {
    if (reported.current) return;
    reported.current = true;
    void reportError({
      ref: info.ref,
      area,
      path: typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined,
      message: info.message,
      detail: info.detail,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    });
  }, [info, area]);

  const report = [`Problem: ${info.message}`, info.ref ? `Reference: ${info.ref}` : null, `Page: ${typeof window !== "undefined" ? window.location.href : ""}`, `Time: ${new Date().toISOString()}`, info.detail ? `Details: ${info.detail}` : null].filter(Boolean).join("\n");
  const offline = /internet connection/i.test(info.message);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-10 text-center">
      <span className={`mb-5 flex h-20 w-20 items-center justify-center rounded-full text-4xl shadow-inner ring-8 ${offline ? "bg-sky-50 ring-sky-50/60" : "bg-amber-50 ring-amber-50/60"}`}>{offline ? "📡" : "🛠️"}</span>
      <h1 className="text-xl font-extrabold tracking-tight text-neutral-900">{offline ? "You seem to be offline" : "Something went wrong"}</h1>
      <p className="mt-2 text-sm text-neutral-600">{info.message}</p>
      {info.ref && (
        <p className="mt-3 rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600">
          Reference <b className="font-mono tracking-wider text-neutral-900">{info.ref}</b>
          <span className="text-neutral-500"> · quote it if you contact support</span>
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {reset && (
          <button type="button" onClick={reset} className="inline-flex h-11 items-center rounded-full bg-brand-700 px-6 text-sm font-bold text-white transition hover:bg-brand-800 active:scale-[0.98]">
            Try again
          </button>
        )}
        <a href={HOME[area].href} className="inline-flex h-11 items-center rounded-full border border-neutral-300 bg-white px-6 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50">
          {HOME[area].label}
        </a>
      </div>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(report).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          });
        }}
        className="mt-4 text-xs font-semibold text-brand-700 hover:underline"
      >
        {copied ? "Copied ✓" : "Copy the problem details"}
      </button>
      {staff && info.detail && (
        <details className="mt-4 w-full max-w-md rounded-xl border border-neutral-200 bg-white p-3 text-start text-xs text-neutral-600">
          <summary className="cursor-pointer font-semibold text-neutral-700">Technical details</summary>
          <p className="mt-2 break-words font-mono text-[11px] leading-relaxed">{info.detail}</p>
        </details>
      )}
    </div>
  );
}

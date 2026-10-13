"use client";

import { useEffect, useRef, useState } from "react";
import { errorInfo, type ErrorInfo } from "@/lib/errors";
import { reportError } from "@/lib/actions/report-error";

/** Safety net: a failure nobody caught (for example a button whose request failed) still tells the person what happened. */
export default function GlobalErrorToast() {
  const [info, setInfo] = useState<ErrorInfo | null>(null);
  const last = useRef("");

  useEffect(() => {
    function show(reason: unknown) {
      const digest = reason && typeof reason === "object" ? String((reason as { digest?: unknown }).digest ?? "") : "";
      // Navigation signals (redirects, not-found) are normal, not problems.
      if (digest.startsWith("NEXT_")) return;
      const raw = reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "";
      // Only failures that came from our own server or the network: other scripts' noise is not ours to announce.
      const ours = digest.startsWith("UE1:") || /Server Components render|failed to fetch|load failed|networkerror/i.test(raw);
      if (!ours) return;
      const i = errorInfo(reason);
      if (last.current === i.message + (i.ref ?? "")) return;
      last.current = i.message + (i.ref ?? "");
      setInfo(i);
      void reportError({ ref: i.ref, area: "toast", path: window.location.pathname, message: i.message, detail: i.detail, userAgent: navigator.userAgent });
    }
    const onRejection = (e: PromiseRejectionEvent) => show(e.reason);
    const onError = (e: ErrorEvent) => show(e.error);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  useEffect(() => {
    if (!info) return;
    const t = setTimeout(() => setInfo(null), 9000);
    return () => clearTimeout(t);
  }, [info]);

  if (!info) return null;
  return (
    <div role="alert" className="fixed inset-x-3 bottom-24 z-[3000] mx-auto max-w-md rounded-2xl border border-rose-200 bg-white p-4 shadow-2xl md:bottom-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-lg" aria-hidden>
          ⚠️
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-neutral-900">That didn&apos;t work</p>
          <p className="mt-0.5 text-sm text-neutral-600">{info.message}</p>
          {info.ref && <p className="mt-1 text-xs text-neutral-500">Reference <b className="font-mono text-neutral-600">{info.ref}</b></p>}
        </div>
        <button type="button" onClick={() => setInfo(null)} aria-label="Dismiss" className="shrink-0 text-neutral-500 hover:text-neutral-700">
          ✕
        </button>
      </div>
    </div>
  );
}

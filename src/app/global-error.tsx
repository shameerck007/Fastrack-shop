"use client";

import { useMemo } from "react";
import { errorInfo } from "@/lib/errors";
import { BRAND } from "@/lib/brand";

/** The last safety net: shown when even the page frame fails to load, so it carries its own styling. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const info = useMemo(() => errorInfo(error, "The page could not be loaded."), [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f8fafc", color: "#0f172a" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
          <div style={{ maxWidth: 420 }}>
            <div style={{ fontSize: 48 }}>🛠️</div>
            <h1 style={{ fontSize: 22, margin: "12px 0 8px" }}>Something went wrong</h1>
            <p style={{ color: "#475569", fontSize: 14, lineHeight: 1.5 }}>{info.message}</p>
            {info.ref && (
              <p style={{ fontSize: 12, color: "#64748b" }}>
                Reference <b style={{ fontFamily: "monospace", color: "#0f172a" }}>{info.ref}</b>
              </p>
            )}
            <button onClick={reset} style={{ marginTop: 16, background: BRAND[700], color: "white", border: 0, borderRadius: 999, padding: "12px 24px", fontWeight: 700, cursor: "pointer" }}>
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

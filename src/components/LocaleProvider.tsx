"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/t";

interface LocaleCtx {
  locale: Locale;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<LocaleCtx | null>(null);

// The server already decided the locale (cookie or Accept-Language) before
// the first byte was sent, so this just makes it — and a translate()
// bound to it — available to client components without prop-drilling.
export default function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo<LocaleCtx>(
    () => ({
      locale,
      t: (key, vars) => translate(locale, key, vars),
    }),
    [locale]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocale(): LocaleCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}

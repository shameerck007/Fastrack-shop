"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocale } from "@/lib/actions/locale";
import { useLocale } from "@/components/LocaleProvider";
import type { Locale } from "@/lib/i18n/config";

export default function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    if (next === locale || pending) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div
      className={`flex items-center gap-1 rounded-full border border-neutral-200 p-0.5 text-xs font-semibold ${className}`}
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => switchTo("en")}
        disabled={pending}
        className={`rounded-full px-1.5 py-0.5 transition ${
          locale === "en" ? "bg-blue-700 text-white" : "text-neutral-500 hover:text-neutral-900"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => switchTo("ar")}
        disabled={pending}
        className={`rounded-full px-1.5 py-0.5 transition ${
          locale === "ar" ? "bg-blue-700 text-white" : "text-neutral-500 hover:text-neutral-900"
        }`}
      >
        عربي
      </button>
    </div>
  );
}

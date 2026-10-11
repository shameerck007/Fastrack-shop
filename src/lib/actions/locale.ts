"use server";


import { failure } from "@/lib/errors";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";

export async function setLocale(locale: Locale) {
  try {
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  } catch (e) {
    return failure(e) as never;
  }
}

"use server";

/**
 * Best-effort English -> Arabic auto-translate, used as a convenience default
 * for the Arabic name field on products/categories. Uses MyMemory's free,
 * no-API-key translation endpoint (same "free tier, no signup" pattern as the
 * Nominatim/Stadia Maps integrations elsewhere in this app).
 *
 * This is never a hard dependency: the Arabic name field stays a plain,
 * fully-editable text input, and any failure here just means the field
 * starts out empty for the admin/merchant to fill in themselves.
 */
export async function autoTranslateToArabic(text: string): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=en|ar`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!res.ok) return null;

    const data = (await res.json()) as {
      responseStatus?: number | string;
      responseData?: { translatedText?: string };
    };
    if (String(data.responseStatus) !== "200") return null;

    const translated = data.responseData?.translatedText?.trim();
    if (!translated) return null;
    // MyMemory echoes the source text back (sometimes wrapped) when it has no
    // translation to offer — treat that as "no result" rather than as Arabic.
    if (translated.toLowerCase() === trimmed.toLowerCase()) return null;
    return translated;
  } catch {
    return null;
  }
}

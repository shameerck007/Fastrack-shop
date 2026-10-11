"use server";


import { failure } from "@/lib/errors";
import { translateToArabic } from "@/lib/translate";

/**
 * Best-effort English to Arabic, used to fill the Arabic fields in the admin and supplier forms. Uses Google Cloud Translation when
 * GOOGLE_TRANSLATE_API_KEY is set, otherwise the free MyMemory service. Never a hard dependency: the Arabic field stays a plain,
 * editable input, and a failure just leaves it empty for the person to fill in.
 */
export async function autoTranslateToArabic(text: string): Promise<string | null> {
  try {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 600) return await null;
  const [out] = await translateToArabic([trimmed]);
  return await out && out.toLowerCase() !== trimmed.toLowerCase() ? out : null;

  } catch (e) {
    return failure(e) as never;
  }
}

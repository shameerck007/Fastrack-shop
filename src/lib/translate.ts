// English to Arabic for names and descriptions typed into the admin and supplier forms.
// Uses Google Cloud Translation when GOOGLE_TRANSLATE_API_KEY is set (the reliable choice for production),
// otherwise the free MyMemory service (no key, small daily allowance). Results are remembered while the server runs.

const cache = new Map<string, string>();

async function viaGoogle(texts: string[], key: string): Promise<string[] | null> {
  try {
    const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: texts, source: "en", target: "ar", format: "text" }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { translations?: { translatedText: string }[] } };
    const out = json.data?.translations?.map((t) => t.translatedText);
    return out && out.length === texts.length ? out : null;
  } catch {
    return null;
  }
}

async function viaMyMemory(text: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ar`);
    if (!res.ok) return null;
    const json = (await res.json()) as { responseData?: { translatedText?: string }; responseStatus?: number | string };
    const out = json.responseData?.translatedText?.trim();
    // The service answers with an error sentence (still HTTP 200) when the allowance is used up.
    if (!out || String(json.responseStatus) !== "200" || /MYMEMORY|QUERY LENGTH|INVALID/i.test(out) || !/[؀-ۿ]/.test(out)) return null;
    return out;
  } catch {
    return null;
  }
}

/** Arabic for each text, in the same order; an empty string where a translation was not possible. */
export async function translateToArabic(texts: string[]): Promise<string[]> {
  const clean = texts.map((t) => t.trim());
  const result: string[] = clean.map((t) => cache.get(t) ?? "");
  const missing = clean.map((t, i) => ({ t, i })).filter(({ t, i }) => t && !result[i]);
  if (missing.length === 0) return result;

  const key = process.env.GOOGLE_TRANSLATE_API_KEY;
  const google = key ? await viaGoogle(missing.map((m) => m.t), key) : null;
  if (google) {
    missing.forEach((m, k) => {
      result[m.i] = google[k];
      cache.set(m.t, google[k]);
    });
    return result;
  }
  for (const m of missing) {
    const out = await viaMyMemory(m.t);
    if (out) {
      result[m.i] = out;
      cache.set(m.t, out);
    }
  }
  return result;
}

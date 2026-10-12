/** Code 128 (subset B) barcode encoder. Printable ASCII only. Pure and dependency-free, so it runs in the PDF builder on Cloudflare Workers. */

// Bar/space widths for symbols 0 to 106, in modules. Each pattern is bar, space, bar, space, bar, space (the stop pattern has a final bar).
const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];
const START_B = 104;
const STOP = 106;

/** True when every character can be encoded. */
export const code128Supports = (text: string) => text.length > 0 && /^[\x20-\x7E]+$/.test(text);

/** The symbol values for a text: start, characters, check digit, stop. */
export function code128Symbols(text: string): number[] {
  if (!code128Supports(text)) throw new Error("Code 128 can only hold printable ASCII characters.");
  const values = [...text].map((c) => c.charCodeAt(0) - 32);
  const sum = values.reduce((n, v, i) => n + v * (i + 1), START_B);
  return [START_B, ...values, sum % 103, STOP];
}

/** Widths in modules, alternating bar then space, starting with a bar. */
export function code128Widths(text: string): number[] {
  return code128Symbols(text).flatMap((s) => [...PATTERNS[s]].map(Number));
}

/** Total width in modules (without the quiet zones). */
export const code128Modules = (text: string) => code128Widths(text).reduce((a, b) => a + b, 0);

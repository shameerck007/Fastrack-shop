/**
 * The brand blues as plain hex strings, for the few places CSS classes cannot reach: SVG attributes, chart code and inline
 * styles that add an alpha suffix (for example `${BRAND[600]}1a`). Everything else uses the `brand-*` colour classes.
 * Keep this in step with the --color-brand-* scale in src/app/globals.css: when the brand colour changes, change both.
 * (Emails and the SVG store placeholders keep their own literal colours on purpose: they are rendered outside the app's CSS.)
 */
export const BRAND = {
  400: "#60a5fa",
  500: "#3b82f6",
  600: "#2563eb",
  700: "#1d4ed8",
  800: "#1e40af",
} as const;

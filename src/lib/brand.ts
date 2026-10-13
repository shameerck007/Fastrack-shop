/**
 * The brand blues as plain hex strings, for the few places CSS classes cannot reach: SVG attributes, chart code and inline
 * styles that add an alpha suffix (for example `${BRAND[600]}1a`). Everything else uses the `brand-*` colour classes.
 * Keep this in step with the --color-brand-* scale in src/app/globals.css: when the brand colour changes, change both.
 * Emails, map markers and the SVG store placeholders are drawn outside the app's CSS, so they carry these same values as literal hex.
 * The scale follows the logo: azure #0070D0, with the deep navy #002050 as the darkest step.
 */
export const BRAND = {
  400: "#2e92e8",
  500: "#0a7fdd",
  600: "#0070d0",
  700: "#005fb0",
  800: "#004a8c",
} as const;

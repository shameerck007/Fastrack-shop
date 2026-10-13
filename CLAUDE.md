# FasTrack Shop: project rules

## Theme and UI consistency (applies to every new page, feature and popup, in every role)

New work must follow the system's colours and patterns. Look at the nearest existing page first and copy its structure. Check phone width (375px) as well as desktop.

- **Colours:** only the `brand-*` Tailwind scale and the `ink` token from `src/app/globals.css` (azure #0070D0, deep navy #002050). Where CSS classes cannot reach (SVG, charts, emails, map markers, inline alpha colours) use `BRAND` from `src/lib/brand.ts`. Keep `globals.css` and `brand.ts` in step. No ad-hoc blues or hard-coded colours that bypass the tokens.
- **Page headers:** plain headers (`PageHeader` in `AdminUi`, `ui/PortalPageHeader`, `PageHero`). Never a solid blue banner card.
- **Navigation:** breadcrumbs, not Back buttons. Shop pages: `AutoBreadcrumbs` (add the route to `trailFor`). Portals (admin, merchant, rider, warehouse, platform): `PortalBreadcrumbs`; add new section names to its `NAMES` map and use `CrumbLabel` on detail pages that have an id in the address.
- **Forms and popups:** `ui/FormDialog` (+ `DialogSection`), `Modal`, `Field`, `inputClass`, `primaryButton` / `secondaryButton` from `ui/Form`.
- **Confirm and prompt boxes:** `useDialogs()` from `components/ui/Dialogs` (`confirm`, `prompt`). Never `window.confirm`, `window.prompt` or `alert`, which show the browser's unstyled "localhost says" box.
- **Server code:** client components must not import server-only modules; share pure helpers through a plain `src/lib/*-utils.ts` file.

## Loading screen

`src/components/AppSplash.tsx` (inline SVG and CSS) and `SplashGate.tsx` (4 s minimum, plays on every launch except refresh/back). The root layout streams it before the database lookups, which live in `AppFrame` inside a Suspense boundary. Do not add awaited database work to `RootLayout` itself, or the blank white screen at app launch comes back.

// Shown the instant a link is tapped, while the next page is fetched, so the app never looks frozen.
// The header and bottom tabs stay in place; only the page area shows this placeholder.
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 py-5" aria-busy="true" aria-label="Loading">
      <div className="mb-5 h-8 w-48 rounded-lg bg-neutral-200" />
      <div className="mb-5 h-36 rounded-2xl bg-neutral-200/80" />
      <div className="mb-3 h-5 w-32 rounded bg-neutral-200" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-neutral-100 bg-white p-3">
            <div className="mb-3 aspect-square rounded-xl bg-neutral-200/80" />
            <div className="mb-2 h-3.5 w-3/4 rounded bg-neutral-200" />
            <div className="h-3 w-1/2 rounded bg-neutral-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

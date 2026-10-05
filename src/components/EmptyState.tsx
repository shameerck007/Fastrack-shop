/** Friendly placeholder for an empty list: soft icon disc, message, optional hint. */
export default function EmptyState({ icon = "🛍️", title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-4xl ring-8 ring-blue-50/60">{icon}</span>
      <p className="text-base font-bold text-neutral-900">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-sm text-neutral-500">{hint}</p>}
    </div>
  );
}

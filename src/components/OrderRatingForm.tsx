"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitOrderRating } from "@/lib/actions/order-ratings";
import { useLocale } from "@/components/LocaleProvider";
import type { OrderRating } from "@/lib/orders";

const STAR_LABEL_KEY = [
  "order_rating.star_1",
  "order_rating.star_2",
  "order_rating.star_3",
  "order_rating.star_4",
  "order_rating.star_5",
];

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          className="text-3xl leading-none transition"
          aria-label={`${n} star`}
        >
          <span className={(hover || value) >= n ? "text-amber-500" : "text-neutral-300"}>★</span>
        </button>
      ))}
    </div>
  );
}

export default function OrderRatingForm({
  orderId,
  existingRating,
}: {
  orderId: string;
  existingRating: OrderRating | null;
}) {
  const { t } = useLocale();
  const [rating, setRating] = useState(existingRating?.rating ?? 0);
  const [comment, setComment] = useState(existingRating?.comment ?? "");
  const [editing, setEditing] = useState(!existingRating);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit() {
    if (rating < 1) {
      setError(t("order_rating.pick_a_star"));
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await submitOrderRating(orderId, rating, comment);
        setSubmitted(true);
        setEditing(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("order_rating.could_not_submit"));
      }
    });
  }

  if (!editing && existingRating) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <p className="mb-2 font-medium text-neutral-900">{t("order_rating.title")}</p>
        <div className="flex items-center gap-2">
          <span className="text-xl text-amber-500">
            {"★".repeat(existingRating.rating)}
            <span className="text-neutral-300">{"★".repeat(5 - existingRating.rating)}</span>
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm font-medium text-blue-700 hover:underline"
          >
            {t("order_rating.edit")}
          </button>
        </div>
        {existingRating.comment && <p className="mt-2 text-sm text-neutral-600">{existingRating.comment}</p>}
        {submitted && <p className="mt-2 text-sm text-emerald-600">{t("order_rating.thanks")}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="mb-1 font-medium text-neutral-900">{t("order_rating.title")}</p>
      <p className="mb-3 text-sm text-neutral-500">{t("order_rating.subtitle")}</p>

      <StarPicker value={rating} onChange={setRating} />
      {rating > 0 && <p className="mt-1 text-sm text-neutral-500">{t(STAR_LABEL_KEY[rating - 1])}</p>}

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t("order_rating.comment_placeholder")}
        rows={3}
        maxLength={500}
        className="mt-3 w-full min-h-[2.75rem] rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 hover:border-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="rounded-full bg-blue-700 px-5 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? t("order_rating.submitting") : t("order_rating.submit")}
        </button>
        {existingRating && (
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setError(null);
            }}
            className="text-sm text-neutral-500 hover:text-neutral-800"
          >
            {t("common.cancel")}
          </button>
        )}
      </div>
    </div>
  );
}

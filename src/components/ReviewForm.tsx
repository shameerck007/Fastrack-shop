"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addReview } from "@/lib/actions/reviews";

export default function ReviewForm({ productId }: { productId: string }) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await addReview(productId, rating, comment);
        setComment("");
        setSubmitted(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not submit your review.");
      }
    });
  }

  if (submitted) {
    return <p className="text-sm text-emerald-700">Thanks for your review!</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-sm font-medium">Write a review</p>
      <div className="flex gap-1" onMouseLeave={() => setHoverRating(0)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHoverRating(star)}
            onClick={() => setRating(star)}
            className="text-2xl leading-none"
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
          >
            <span className={(hoverRating || rating) >= star ? "text-amber-500" : "text-neutral-300"}>
              ★
            </span>
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Share your experience with this product (optional)"
        rows={3}
        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Submitting..." : "Submit review"}
      </button>
    </form>
  );
}

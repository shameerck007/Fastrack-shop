"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { addReview } from "@/lib/actions/reviews";
import Modal from "@/components/Modal";

export default function ReviewForm({
  productId,
  isLoggedIn,
}: {
  productId: string;
  isLoggedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  function handleTriggerClick() {
    if (!isLoggedIn) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    setOpen(true);
  }

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

  return (
    <>
      <button
        onClick={handleTriggerClick}
        className="flex items-center gap-2 rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium transition hover:border-blue-600 hover:text-blue-700"
      >
        ★ Write a review
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Write a review">
        {submitted ? (
          <p className="text-sm text-blue-700">Thanks for your review!</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
              className="self-start rounded-full bg-blue-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {pending ? "Submitting..." : "Submit review"}
            </button>
          </form>
        )}
      </Modal>
    </>
  );
}

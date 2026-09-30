export default function StarRating({
  rating,
  count,
  size = "sm",
}: {
  rating: number;
  count?: number;
  size?: "sm" | "lg";
}) {
  const full = Math.round(rating);
  const textSize = size === "lg" ? "text-lg" : "text-xs";

  return (
    <div className="flex items-center gap-1">
      <span className={`${textSize} tracking-tight text-amber-500`} aria-label={`${rating} out of 5 stars`}>
        {"★".repeat(full)}
        <span className="text-neutral-300">{"★".repeat(5 - full)}</span>
      </span>
      {count !== undefined && (
        <span className={`${size === "lg" ? "text-sm" : "text-xs"} text-neutral-500`}>
          {rating.toFixed(1)} ({count})
        </span>
      )}
    </div>
  );
}

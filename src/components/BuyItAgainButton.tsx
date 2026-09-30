"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reorderItems } from "@/lib/actions/orders";
import { notifyCartChanged } from "@/lib/cart-events";
import { useLocale } from "@/components/LocaleProvider";

export default function BuyItAgainButton({
  orderId,
  itemCount,
  fullWidth = false,
}: {
  orderId: string;
  itemCount: number;
  // The orders list stacks this next to "View order details" in a
  // fixed-width column and needs both to match widths exactly; the order
  // detail page uses it standalone and should stay content-sized there.
  fullWidth?: boolean;
}) {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMessage(null);
    startTransition(async () => {
      try {
        const { added, skipped } = await reorderItems(orderId);
        if (added === 0) {
          setMessage(t("orders.reorder_none_added"));
        } else if (skipped === 0) {
          setMessage(t("orders.reorder_all_added", { count: added }));
        } else {
          setMessage(t("orders.reorder_some_added", { added, total: itemCount }));
        }
        if (added > 0) {
          notifyCartChanged();
          router.refresh();
        }
      } catch {
        setMessage(t("orders.reorder_failed"));
      }
    });
  }

  return (
    <div className={`flex flex-col gap-1 ${fullWidth ? "items-stretch" : "items-start"}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={`rounded-full border border-blue-600 px-4 py-1.5 text-center text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50 ${
          fullWidth ? "w-full" : ""
        }`}
      >
        {pending ? t("orders.buying_again") : t("orders.buy_it_again")}
      </button>
      {message && <p className="text-xs text-neutral-500">{message}</p>}
    </div>
  );
}

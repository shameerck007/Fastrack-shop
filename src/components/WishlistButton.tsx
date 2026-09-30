"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toggleWishlist } from "@/lib/actions/wishlist";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";

export default function WishlistButton({
  productId,
  initialInList,
  size = "md",
}: {
  productId: string;
  initialInList: boolean;
  size?: "sm" | "md";
}) {
  const { t } = useLocale();
  const [inList, setInList] = useState(initialInList);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  function handleClick() {
    const prev = inList;
    startTransition(async () => {
      // Same fix as QuickAddToCart: check login client-side first rather
      // than calling the server action and reacting to its "must be
      // logged in" error afterward — that round-trip's own auth check was
      // the path that failed unpredictably on iOS/WebKit for a guest with
      // no session yet, surfacing as an opaque RSC render error.
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
        return;
      }

      setInList(!prev); // optimistic
      try {
        const result = await toggleWishlist(productId);
        setInList(result.inList);
        router.refresh();
      } catch (err) {
        setInList(prev);
        const msg = err instanceof Error ? err.message : "";
        if (msg.toLowerCase().includes("logged in")) {
          router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
        }
      }
    });
  }

  const dim = size === "sm" ? "h-8 w-8 text-base" : "h-10 w-10 text-lg";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={inList ? t("product.remove_from_list") : t("product.add_to_list")}
      title={inList ? t("product.remove_from_list") : t("product.add_to_list")}
      className={`flex ${dim} items-center justify-center rounded-full border shadow-sm transition disabled:opacity-50 ${
        inList
          ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
          : "border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50"
      }`}
    >
      {inList ? "♥" : "♡"}
    </button>
  );
}

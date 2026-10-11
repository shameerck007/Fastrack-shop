"use client";

import ErrorPanel from "@/components/ErrorPanel";

export default function SectionError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPanel error={error} reset={reset} area="warehouse" />;
}

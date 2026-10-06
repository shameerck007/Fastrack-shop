import NextLink from "next/link";
import type { ComponentProps } from "react";

/** next/link with prefetching OFF unless a link asks for it. By default every link in view is pre-loaded, which on a
 * phone fired a dozen full page renders at once and overloaded the server (Cloudflare Error 1101). A tap still
 * navigates instantly with one request; nothing is fetched until then. */
export default function Link({ prefetch = false, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={prefetch} {...props} />;
}

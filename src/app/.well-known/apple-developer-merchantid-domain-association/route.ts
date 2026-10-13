/**
 * Apple Pay checks that we own this web address by fetching this file. Moyasar gives you the file's text when you turn on Apple Pay
 * for the domain; put it in the APPLE_PAY_DOMAIN_FILE secret (`wrangler secret put APPLE_PAY_DOMAIN_FILE`).
 */
export async function GET() {
  const body = process.env.APPLE_PAY_DOMAIN_FILE;
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}

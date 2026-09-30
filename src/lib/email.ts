// Resend's REST API over plain fetch — no SDK dependency (same reasoning
// as web-push.ts: keeps this free of packages that may not play nicely
// with the Cloudflare Workers runtime, and fetch is all Resend needs).
const FROM_ADDRESS = "FasTrack <orders@fastrack.cloud>";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  // Email isn't configured yet — never break the order/status flow that
  // triggered this; just skip sending silently, same as push's no-op.
  if (!apiKey) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: input.to,
        subject: input.subject,
        html: input.html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

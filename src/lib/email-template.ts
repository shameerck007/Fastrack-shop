// Table-based HTML email templates (Amazon/Noon-style order confirmation
// layout) — tables + inline styles, not flexbox/grid, because that's what
// still renders correctly across Outlook/Gmail/etc. email clients.

const LOGO_URL = "https://shop.fastrack.cloud/fastrack-logo-wordmark.png";
const SITE_URL = "https://shop.fastrack.cloud";

export interface EmailLineItem {
  name: string;
  variant?: string;
  quantity: number;
  lineTotalFormatted: string;
  imageUrl?: string | null;
}

export interface EmailInfoCell {
  label: string;
  value: string;
}

export interface EmailSummaryRow {
  label: string;
  value: string;
  bold?: boolean;
}

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** The "Order Number | Order Date | Total | Arriving" grid Amazon shows
 * right under the confirmation heading. */
export function renderInfoGrid(cells: EmailInfoCell[]): string {
  const cols = cells
    .map(
      (c) => `
        <td style="padding:12px 16px;border-right:1px solid #e5e5e5;vertical-align:top;">
          <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:0.3px;color:#767676;">${esc(c.label)}</p>
          <p style="margin:2px 0 0;font-family:Arial,sans-serif;font-size:13px;color:#111111;font-weight:600;">${esc(c.value)}</p>
        </td>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f7f7;border:1px solid #e5e5e5;border-radius:6px;margin:16px 0;">
    <tr>${cols}</tr>
  </table>`;
}

export function renderOrderItemsTable(items: EmailLineItem[]): string {
  const rows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #eeeeee;" width="68">
          ${
            item.imageUrl
              ? `<img src="${esc(item.imageUrl)}" width="60" height="60" style="border-radius:8px;border:1px solid #e5e5e5;object-fit:cover;display:block;" alt="" />`
              : `<div style="width:60px;height:60px;border-radius:8px;background:#f5f5f5;text-align:center;line-height:60px;font-size:24px;">&#128230;</div>`
          }
        </td>
        <td style="padding:14px 12px;border-bottom:1px solid #eeeeee;font-family:Arial,sans-serif;color:#111111;font-size:14px;vertical-align:top;">
          ${esc(item.name)}${item.variant ? `<br/><span style="color:#666666;font-size:12px;">${esc(item.variant)}</span>` : ""}
          <br/><span style="color:#666666;font-size:12px;">Qty: ${item.quantity}</span>
        </td>
        <td style="padding:14px 0;border-bottom:1px solid #eeeeee;font-family:Arial,sans-serif;color:#111111;font-size:14px;text-align:right;white-space:nowrap;vertical-align:top;">
          ${esc(item.lineTotalFormatted)}
        </td>
      </tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
}

export function renderSummaryTable(rows: EmailSummaryRow[]): string {
  const rowsHtml = rows
    .map(
      (r) => `
      <tr>
        <td style="padding:4px 0;font-family:Arial,sans-serif;font-size:${r.bold ? "15px" : "13px"};color:${
          r.bold ? "#111111" : "#555555"
        };font-weight:${r.bold ? "700" : "400"};">${esc(r.label)}</td>
        <td style="padding:4px 0;font-family:Arial,sans-serif;font-size:${r.bold ? "15px" : "13px"};color:${
          r.bold ? "#111111" : "#555555"
        };font-weight:${r.bold ? "700" : "400"};text-align:right;">${esc(r.value)}</td>
      </tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>`;
}

/** A boxed section with a heading — used for Shipping Address / Payment
 * Method, same visual pattern Amazon uses. */
export function renderBoxSection(heading: string, bodyHtml: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border:1px solid #e5e5e5;border-radius:6px;">
    <tr>
      <td style="padding:14px 16px;">
        <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#111111;text-transform:uppercase;letter-spacing:0.3px;">${esc(heading)}</p>
        <div style="font-family:Arial,sans-serif;font-size:13px;color:#333333;line-height:1.6;">${bodyHtml}</div>
      </td>
    </tr>
  </table>`;
}

export function renderEmailShell(input: {
  preheader: string;
  heading: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const { preheader, heading, bodyHtml, ctaLabel, ctaUrl } = input;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>FasTrack Shop</title>
</head>
<body style="margin:0;padding:0;background-color:#eaeded;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eaeded;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #dddddd;">
          <tr>
            <td style="background-color:#ffffff;padding:18px 32px;border-bottom:1px solid #eeeeee;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td><img src="${LOGO_URL}" alt="FasTrack" height="26" style="display:block;height:26px;width:auto;" /></td>
                <td style="padding-left:10px;"><span style="display:inline-block;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#ffffff;background-color:#1d4ed8;padding:3px 9px;border-radius:4px;">Shop</span></td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:22px;color:#111111;">${esc(heading)}</h1>
              <div style="font-family:Arial,sans-serif;font-size:14px;color:#333333;line-height:1.6;">
                ${bodyHtml}
              </div>
              ${
                ctaUrl && ctaLabel
                  ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                      <tr>
                        <td style="border-radius:24px;background-color:#1d4ed8;">
                          <a href="${esc(ctaUrl)}" style="display:inline-block;padding:11px 26px;font-family:Arial,sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:24px;">${esc(ctaLabel)}</a>
                        </td>
                      </tr>
                    </table>`
                  : ""
              }
            </td>
          </tr>
          <tr>
            <td style="background-color:#f7f7f7;padding:20px 32px;border-top:1px solid #eeeeee;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:16px;"><a href="${SITE_URL}/orders" style="font-family:Arial,sans-serif;font-size:12px;color:#1d4ed8;text-decoration:none;">Your Orders</a></td>
                  <td style="padding-right:16px;"><a href="${SITE_URL}/account" style="font-family:Arial,sans-serif;font-size:12px;color:#1d4ed8;text-decoration:none;">Your Account</a></td>
                  <td><a href="${SITE_URL}" style="font-family:Arial,sans-serif;font-size:12px;color:#1d4ed8;text-decoration:none;">Contact Us</a></td>
                </tr>
              </table>
              <p style="margin:12px 0 0;font-family:Arial,sans-serif;font-size:11px;color:#999999;">This is an automated message from FasTrack Shop. &copy; ${new Date().getFullYear()} FasTrack. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

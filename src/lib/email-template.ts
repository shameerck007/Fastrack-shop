// Table-based HTML email templates (Amazon/Noon-style order confirmation
// layout) — tables + inline styles, not flexbox/grid, because that's what
// still renders correctly across Outlook/Gmail/etc. email clients.

export interface EmailLineItem {
  name: string;
  variant?: string;
  quantity: number;
  lineTotalFormatted: string;
  imageUrl?: string | null;
}

export interface EmailSummaryRow {
  label: string;
  value: string;
  bold?: boolean;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderOrderItemsTable(items: EmailLineItem[]): string {
  const rows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #eeeeee;" width="56">
          ${
            item.imageUrl
              ? `<img src="${esc(item.imageUrl)}" width="48" height="48" style="border-radius:8px;border:1px solid #e5e5e5;object-fit:cover;display:block;" alt="" />`
              : `<div style="width:48px;height:48px;border-radius:8px;background:#f5f5f5;text-align:center;line-height:48px;font-size:20px;">&#128230;</div>`
          }
        </td>
        <td style="padding:12px 12px;border-bottom:1px solid #eeeeee;font-family:Arial,sans-serif;color:#111111;font-size:14px;">
          ${esc(item.name)}${item.variant ? `<br/><span style="color:#666666;font-size:12px;">${esc(item.variant)}</span>` : ""}
          <br/><span style="color:#666666;font-size:12px;">Qty: ${item.quantity}</span>
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #eeeeee;font-family:Arial,sans-serif;color:#111111;font-size:14px;text-align:right;white-space:nowrap;">
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
<title>FasTrack</title>
</head>
<body style="margin:0;padding:0;background-color:#f2f2f2;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2f2f2;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background-color:#1d4ed8;padding:20px 32px;">
              <span style="font-family:Arial,sans-serif;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">FasTrack</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:20px;color:#111111;">${esc(heading)}</h1>
              <div style="font-family:Arial,sans-serif;font-size:14px;color:#333333;line-height:1.6;">
                ${bodyHtml}
              </div>
              ${
                ctaUrl && ctaLabel
                  ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                      <tr>
                        <td style="border-radius:24px;background-color:#1d4ed8;">
                          <a href="${esc(ctaUrl)}" style="display:inline-block;padding:12px 28px;font-family:Arial,sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:24px;">${esc(ctaLabel)}</a>
                        </td>
                      </tr>
                    </table>`
                  : ""
              }
            </td>
          </tr>
          <tr>
            <td style="background-color:#fafafa;padding:20px 32px;border-top:1px solid #eeeeee;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#999999;">This is an automated message from FasTrack Shop. If you didn't expect this email, you can ignore it.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

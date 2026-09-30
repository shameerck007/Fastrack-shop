/**
 * ZATCA (Saudi tax authority) simplified tax invoice QR code.
 *
 * The e-invoicing regulations require the QR to be a base64-encoded TLV
 * (tag-length-value) byte sequence with exactly these 5 fields, in order:
 * 1) seller name, 2) VAT registration number, 3) invoice timestamp (ISO
 * 8601), 4) invoice total including VAT, 5) VAT total. This is what lets a
 * customer (or ZATCA's own app) scan the invoice and verify it.
 *
 * Seller name and VAT number now come from company_settings (configured
 * at /admin/settings) rather than being hardcoded here. Until VAT number
 * is actually set, the QR carries an empty VAT field — an honest signal
 * that this isn't a complete tax document yet, rather than a fake-looking
 * one.
 */

function tlv(tag: number, value: string): Buffer {
  const valueBuffer = Buffer.from(value, "utf8");
  return Buffer.concat([Buffer.from([tag, valueBuffer.length]), valueBuffer]);
}

export function buildZatcaQrPayload(input: {
  sellerName: string;
  vatNumber: string;
  timestamp: string; // ISO 8601
  totalWithVat: number;
  vatTotal: number;
}): string {
  const fields = Buffer.concat([
    tlv(1, input.sellerName),
    tlv(2, input.vatNumber),
    tlv(3, input.timestamp),
    tlv(4, input.totalWithVat.toFixed(2)),
    tlv(5, input.vatTotal.toFixed(2)),
  ]);
  return fields.toString("base64");
}

/**
 * ZATCA (Saudi tax authority) simplified tax invoice QR code.
 *
 * The e-invoicing regulations require the QR to be a base64-encoded TLV
 * (tag-length-value) byte sequence with exactly these 5 fields, in order:
 * 1) seller name, 2) VAT registration number, 3) invoice timestamp (ISO
 * 8601), 4) invoice total including VAT, 5) VAT total. This is what lets a
 * customer (or ZATCA's own app) scan the invoice and verify it.
 *
 * NOTE: FASTRACK_VAT_NUMBER below is a placeholder. Replace it with your
 * real 15-digit KSA VAT registration number before this goes to production
 * — an invoice with a fake VAT number is not a valid tax document.
 */

const FASTRACK_SELLER_NAME = "FasTrack Shop";
const FASTRACK_VAT_NUMBER = "300000000000003"; // placeholder — replace with real VAT registration number

function tlv(tag: number, value: string): Buffer {
  const valueBuffer = Buffer.from(value, "utf8");
  return Buffer.concat([Buffer.from([tag, valueBuffer.length]), valueBuffer]);
}

export function buildZatcaQrPayload(input: {
  timestamp: string; // ISO 8601
  totalWithVat: number;
  vatTotal: number;
}): string {
  const fields = Buffer.concat([
    tlv(1, FASTRACK_SELLER_NAME),
    tlv(2, FASTRACK_VAT_NUMBER),
    tlv(3, input.timestamp),
    tlv(4, input.totalWithVat.toFixed(2)),
    tlv(5, input.vatTotal.toFixed(2)),
  ]);
  return fields.toString("base64");
}

import { NextResponse } from "next/server";
import QRCode from "qrcode";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const storeUrl = new URL(`/store/${id}`, request.url).toString();

  const pngBuffer = await QRCode.toBuffer(storeUrl, {
    type: "png",
    margin: 2,
    width: 480,
    errorCorrectionLevel: "M",
  });

  return new NextResponse(new Uint8Array(pngBuffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

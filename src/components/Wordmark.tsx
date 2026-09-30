import Image from "next/image";

const ASPECT = 332 / 51;

export default function Wordmark({ height = 28 }: { height?: number }) {
  return (
    <Image
      src="/fastrack-logo-wordmark.png"
      alt="FasTrack"
      width={Math.round(height * ASPECT)}
      height={height}
      className="shrink-0"
      style={{ height, width: "auto" }}
      priority
    />
  );
}

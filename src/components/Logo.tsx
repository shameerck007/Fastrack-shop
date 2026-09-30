import Image from "next/image";

export default function Logo({ size = 36 }: { size?: number }) {
  return (
    <Image
      src="/fastrack-logo-mark.png"
      alt="FasTrack"
      width={size}
      height={size}
      className="shrink-0"
      priority
    />
  );
}

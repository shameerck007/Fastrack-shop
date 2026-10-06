import { findCountry } from "@/lib/countries";

// Flag emoji do not draw on Windows (they show as "SA" / "IN" letters), so the markets' flags are drawn as SVG.
// Simplified artwork, 4:3. Any other country falls back to its flag emoji.

const W = 36;
const H = 27;

function Art({ code }: { code: string }) {
  switch (code) {
    case "IN": {
      const spokes = Array.from({ length: 12 }, (_, i) => (i * 180) / 12);
      return (
        <>
          <rect width={W} height={9} fill="#FF9933" />
          <rect y={9} width={W} height={9} fill="#FFFFFF" />
          <rect y={18} width={W} height={9} fill="#138808" />
          <g transform="translate(18 13.5)" stroke="#000080" fill="none">
            <circle r={3.6} strokeWidth={0.6} />
            {spokes.map((a) => (
              <line key={a} x1={0} y1={-3.5} x2={0} y2={3.5} strokeWidth={0.3} transform={`rotate(${a})`} />
            ))}
            <circle r={0.7} fill="#000080" stroke="none" />
          </g>
        </>
      );
    }
    case "AE":
      return (
        <>
          <rect width={W} height={9} fill="#00732F" />
          <rect y={9} width={W} height={9} fill="#FFFFFF" />
          <rect y={18} width={W} height={9} fill="#000000" />
          <rect width={9.5} height={H} fill="#FF0000" />
        </>
      );
    case "KW":
      return (
        <>
          <rect width={W} height={9} fill="#007A3D" />
          <rect y={9} width={W} height={9} fill="#FFFFFF" />
          <rect y={18} width={W} height={9} fill="#CE1126" />
          <path d="M0 0l10 9v9l-10 9z" fill="#000000" />
        </>
      );
    case "QA":
      return (
        <>
          <rect width={W} height={H} fill="#8A1538" />
          <path
            d="M0 0h12l4 1.5-4 1.5 4 1.5-4 1.5 4 1.5-4 1.5 4 1.5-4 1.5 4 1.5-4 1.5 4 1.5-4 1.5 4 1.5-4 1.5 4 1.5-4 1.5H0z"
            fill="#fff"
          />
        </>
      );
    case "BH":
      return (
        <>
          <rect width={W} height={H} fill="#CE1126" />
          <path d="M0 0h11l5 2.7-5 2.7 5 2.7-5 2.7 5 2.7-5 2.7 5 2.7-5 2.7 5 2.7-5 2.7H0z" fill="#fff" />
        </>
      );
    case "OM":
      return (
        <>
          <rect width={W} height={9} fill="#FFFFFF" />
          <rect y={9} width={W} height={9} fill="#DB161B" />
          <rect y={18} width={W} height={9} fill="#008000" />
          <rect width={10} height={H} fill="#DB161B" />
        </>
      );
    default:
      return null;
  }
}

const DRAWN = new Set(["IN", "AE", "KW", "QA", "BH", "OM"]);

/** The country's flag as a small rounded image. Size it with Tailwind (default 24 x 18 px). */
export default function Flag({ code, className = "h-[18px] w-6" }: { code: string; className?: string }) {
  const c = (code ?? "").toUpperCase();
  // Saudi Arabia: the official artwork (with the Arabic script and sword) as an image.
  if (c === "SA") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/flags/sa.png"
        alt="Saudi Arabia flag"
        className={`inline-block shrink-0 rounded-[3px] bg-[#006C35] object-contain shadow-[0_0_0_1px_rgba(0,0,0,0.12)] ${className}`}
      />
    );
  }
  if (!DRAWN.has(c)) {
    return (
      <span className={`inline-flex items-center justify-center ${className}`} aria-hidden>
        {findCountry(c).flag}
      </span>
    );
  }
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`inline-block shrink-0 rounded-[3px] shadow-[0_0_0_1px_rgba(0,0,0,0.12)] ${className}`}
      role="img"
      aria-label={`${findCountry(c).name} flag`}
    >
      <Art code={c} />
    </svg>
  );
}

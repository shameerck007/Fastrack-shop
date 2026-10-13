/**
 * The full-screen loading screen shown the moment the app is opened from the phone's icon (or the site is opened fresh).
 * It starts as the phone's own white splash and comes alive straight away: a FasTrack delivery rider on a scooter riding
 * through a city at dusk. The rider stays in the middle and the world moves past it (three layers of buildings at three
 * speeds, street lamps, clouds and the road markings), so it always rides forward. Everything is drawn here as SVG and CSS,
 * so it needs no image download, looks the same on every phone and arrives with the very first bytes of the page.
 * SplashGate (client) fades it out once the app has started. It is skipped for the rest of a browsing session after the first time.
 */
const CSS = `
html.no-splash #ft-splash{display:none}
#ft-splash{position:fixed;inset:0;z-index:99999;overflow:hidden;background:linear-gradient(180deg,#fff 0%,#eaf4fe 38%,#cfe6fb 68%,#a9d0f5 100%);color:#002050;transition:opacity .4s ease,visibility .4s ease}
#ft-splash.ft-out{opacity:0;visibility:hidden;pointer-events:none}
#ft-splash .ft-head{position:absolute;left:0;right:0;top:max(9vh,calc(env(safe-area-inset-top) + 28px));display:flex;flex-direction:column;align-items:center;text-align:center;padding:0 24px}
#ft-splash .ft-logo{width:min(62vw,260px);height:auto;display:block}
#ft-splash .ft-tag{margin-top:14px;font:600 15px/1.3 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.01em;color:#005fb0;opacity:0;animation:ft-fade .6s ease .3s forwards}
#ft-splash .ft-dots{display:flex;gap:7px;margin-top:16px}
#ft-splash .ft-dots i{width:8px;height:8px;border-radius:50%;background:#0070d0;opacity:.25;animation:ft-dot 1.2s ease-in-out infinite}
#ft-splash .ft-dots i:nth-child(2){animation-delay:.18s}
#ft-splash .ft-dots i:nth-child(3){animation-delay:.36s}
#ft-splash .ft-layer{position:absolute;left:0;display:flex;width:max-content;will-change:transform}
#ft-splash .ft-layer svg{flex:none;display:block;height:100%;width:auto}
#ft-splash .ft-clouds{top:30vh;height:12vh;animation:ft-scroll 60s linear infinite}
#ft-splash .ft-far{bottom:19.5vh;height:30vh;animation:ft-scroll 22s linear infinite}
#ft-splash .ft-mid{bottom:19.5vh;height:24vh;animation:ft-scroll 9s linear infinite}
#ft-splash .ft-near{bottom:19.5vh;height:15vh;animation:ft-scroll 3.4s linear infinite}
#ft-splash .ft-road{position:absolute;left:0;right:0;bottom:0;height:20vh;background:linear-gradient(180deg,#1b3f73 0%,#0f2f5c 100%)}
#ft-splash .ft-road:before{content:"";position:absolute;left:0;right:0;top:0;height:5px;background:#5b94d4}
#ft-splash .ft-dash{position:absolute;left:0;right:0;top:56%;height:4px;background:repeating-linear-gradient(90deg,#fff 0 38px,transparent 38px 90px);animation:ft-road .55s linear infinite}
#ft-splash .ft-rider{position:absolute;left:50%;bottom:calc(20vh - 7.2vh);width:min(54vw,240px);margin-left:calc(min(54vw,240px) / -2);animation:ft-bob .38s ease-in-out infinite alternate}
#ft-splash .ft-rider svg{display:block;width:100%;height:auto;overflow:visible}
#ft-splash .ft-spin{transform-box:fill-box;transform-origin:center;animation:ft-wheel .5s linear infinite}
#ft-splash .ft-wind{transform-box:fill-box;transform-origin:right center;animation:ft-wind .6s ease-out infinite}
#ft-splash .ft-wind.b{animation-delay:.2s}
#ft-splash .ft-wind.c{animation-delay:.4s}
#ft-splash .ft-puff{transform-box:fill-box;transform-origin:center;animation:ft-puff 1s ease-out infinite}
#ft-splash .ft-puff.b{animation-delay:.5s}
@keyframes ft-scroll{to{transform:translateX(-33.3333%)}}
@keyframes ft-road{to{background-position:-90px 0}}
@keyframes ft-bob{from{transform:translateY(0)}to{transform:translateY(-3px)}}
@keyframes ft-wheel{to{transform:rotate(360deg)}}
@keyframes ft-wind{0%{opacity:0;transform:translateX(10px) scaleX(.2)}30%{opacity:.85}100%{opacity:0;transform:translateX(-30px) scaleX(1)}}
@keyframes ft-puff{0%{opacity:.6;transform:translateX(0) scale(.4)}100%{opacity:0;transform:translateX(-38px) scale(1.7)}}
@keyframes ft-fade{to{opacity:1}}
@keyframes ft-dot{0%,100%{opacity:.25;transform:scale(1)}50%{opacity:1;transform:scale(1.25)}}
@media (prefers-reduced-motion:reduce){#ft-splash .ft-layer,#ft-splash .ft-dash,#ft-splash .ft-rider,#ft-splash .ft-spin,#ft-splash .ft-wind,#ft-splash .ft-puff,#ft-splash .ft-dots i{animation:none}}
`;

/** A repeatable pseudo-random sequence, so the skyline is the same on the server and the client and every tile joins the next one. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const TILE_W = 600;

/** One tile of skyline: buildings standing on the bottom edge, some with lit windows and aerials. Tiles repeat seamlessly. */
function Skyline({ seed, minH, maxH, fill, windows, lit }: { seed: number; minH: number; maxH: number; fill: string[]; windows: string; lit: string }) {
  const rnd = seeded(seed);
  const H = 300;
  const items: React.ReactNode[] = [];
  let x = 0;
  let i = 0;
  while (x < TILE_W) {
    const w = Math.min(TILE_W - x, 38 + Math.floor(rnd() * 44));
    const h = minH + Math.floor(rnd() * (maxH - minH));
    const y = H - h;
    items.push(<rect key={`b${i}`} x={x} y={y} width={w} height={h} fill={fill[i % fill.length]} />);
    if (w > 30 && rnd() > 0.6) items.push(<rect key={`a${i}`} x={x + w / 2 - 1} y={y - 22} width="2.4" height="22" fill={fill[i % fill.length]} />);
    for (let r = 0; r < Math.floor((h - 14) / 18); r++) {
      for (let c = 0; c < Math.floor((w - 8) / 12); c++) {
        const on = rnd() > 0.72;
        items.push(<rect key={`w${i}-${r}-${c}`} x={x + 6 + c * 12} y={y + 10 + r * 18} width="6" height="9" rx="1" fill={on ? lit : windows} />);
      }
    }
    x += w + (rnd() > 0.7 ? 6 : 0);
    i++;
  }
  return (
    <svg viewBox={`0 0 ${TILE_W} ${H}`} preserveAspectRatio="xMinYMax meet" aria-hidden="true">
      {items}
    </svg>
  );
}

function Posts() {
  return (
    <svg viewBox="0 0 600 150" preserveAspectRatio="xMinYMax meet" aria-hidden="true">
      {[60, 240, 420].map((x) => (
        <g key={x}>
          <rect x={x} y="22" width="5" height="128" rx="2" fill="#2b5a99" />
          <path d={`M${x + 2.5} 24 q26 -2 30 12`} stroke="#2b5a99" strokeWidth="5" fill="none" strokeLinecap="round" />
          <circle cx={x + 33} cy="40" r="7" fill="#ffd54a" />
          <circle cx={x + 33} cy="40" r="15" fill="#ffd54a" opacity=".25" />
        </g>
      ))}
    </svg>
  );
}

function Clouds() {
  return (
    <svg viewBox="0 0 600 80" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
      {[
        [70, 40, 1],
        [300, 22, 0.7],
        [470, 50, 0.9],
      ].map(([x, y, k]) => (
        <g key={x} fill="#fff" opacity=".85" transform={`translate(${x} ${y}) scale(${k})`}>
          <ellipse cx="0" cy="8" rx="34" ry="11" />
          <ellipse cx="-14" cy="0" rx="18" ry="12" />
          <ellipse cx="12" cy="-3" rx="22" ry="14" />
        </g>
      ))}
    </svg>
  );
}

/** The FasTrack rider, facing right: azure scooter, navy helmet, cyan jacket, branded delivery box on the back. */
function Rider() {
  return (
    <svg viewBox="0 0 130 84" aria-hidden="true">
      {/* wind streaks and exhaust puffs behind (left of) the scooter */}
      <g stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
        <line className="ft-wind" x1="-4" y1="30" x2="12" y2="30" />
        <line className="ft-wind b" x1="-12" y1="42" x2="8" y2="42" />
        <line className="ft-wind c" x1="-2" y1="54" x2="14" y2="54" />
      </g>
      <circle className="ft-puff" cx="14" cy="64" r="4" fill="#cfe3f8" />
      <circle className="ft-puff b" cx="14" cy="64" r="4" fill="#cfe3f8" />
      {/* ground shadow */}
      <ellipse cx="62" cy="80" rx="46" ry="3.2" fill="#000a20" opacity=".3" />
      {/* delivery box */}
      <rect x="6" y="22" width="36" height="28" rx="5" fill="#005fb0" />
      <rect x="6" y="22" width="36" height="7" rx="4" fill="#0070d0" />
      <path d="M24 34 l7 10 h-4.2 l-2.8 -4 l-2.8 4 h-4.2 z" fill="#fff" />
      {/* scooter body */}
      <path d="M20 56 Q20 44 36 44 L58 44 L58 58 Z" fill="#0070d0" />
      <path d="M44 58 H88 L84 50 H52 Z" fill="#005fb0" />
      <path d="M84 58 L90 26 Q92 22 96 24 L99 26 L94 58 Z" fill="#0070d0" />
      <rect x="35" y="39" width="26" height="6" rx="3" fill="#002050" />
      {/* handlebar + headlight */}
      <path d="M90 26 L88 20 H100" stroke="#002050" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M97 31 h6 a3 3 0 0 1 0 6 h-6 z" fill="#ffd54a" />
      {/* rider: leg, body, arm, head, helmet */}
      <path d="M52 41 L66 47 L68 58" stroke="#002050" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M50 40 Q56 24 66 20" stroke="#00b0f0" strokeWidth="9" fill="none" strokeLinecap="round" />
      <path d="M64 24 L88 24" stroke="#00b0f0" strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="90" cy="24" r="2.8" fill="#f2c9a0" />
      <circle cx="70" cy="13" r="7" fill="#f2c9a0" />
      <path d="M62.6 13 a7.4 7.4 0 0 1 14.8 0 z" fill="#002050" />
      <path d="M72 11 h6 v4 h-5 z" fill="#8fd3f4" />
      {/* wheels */}
      <g>
        <circle cx="30" cy="68" r="11" fill="#001535" />
        <circle cx="30" cy="68" r="5" fill="#cfe3f8" />
        <g className="ft-spin"><line x1="30" y1="60" x2="30" y2="76" stroke="#0070d0" strokeWidth="2" /><line x1="22" y1="68" x2="38" y2="68" stroke="#0070d0" strokeWidth="2" /></g>
      </g>
      <g>
        <circle cx="92" cy="68" r="11" fill="#001535" />
        <circle cx="92" cy="68" r="5" fill="#cfe3f8" />
        <g className="ft-spin"><line x1="92" y1="60" x2="92" y2="76" stroke="#0070d0" strokeWidth="2" /><line x1="84" y1="68" x2="100" y2="68" stroke="#0070d0" strokeWidth="2" /></g>
      </g>
    </svg>
  );
}

/** Six copies of a tile side by side; the strip slides left by two tiles (a third of its width) and starts over, so it never shows a seam. */
function Strip({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <div className={`ft-layer ${className}`}>
      {children}
      {children}
      {children}
      {children}
      {children}
      {children}
    </div>
  );
}

export default function AppSplash() {
  return (
    <>
      {/* Runs before the first paint: a visitor who has already seen the splash this session never sees it again. */}
      <script dangerouslySetInnerHTML={{ __html: "try{if(sessionStorage.getItem('ft_splash'))document.documentElement.classList.add('no-splash')}catch(e){}" }} />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <noscript>
        <style>{"#ft-splash{display:none}"}</style>
      </noscript>
      <div id="ft-splash" aria-hidden="true">
        <Strip className="ft-clouds">
          <Clouds />
        </Strip>
        <Strip className="ft-far">
          <Skyline seed={7} minH={120} maxH={250} fill={["#c3dcf6", "#b3d1f1", "#cde2f8"]} windows="#d9e9fa" lit="#fff" />
        </Strip>
        <Strip className="ft-mid">
          <Skyline seed={21} minH={90} maxH={210} fill={["#8dbbea", "#7eaee3", "#98c3ee"]} windows="#a8cbf0" lit="#ffe9a0" />
        </Strip>
        <Strip className="ft-near">
          <Posts />
        </Strip>
        <div className="ft-road">
          <span className="ft-dash" />
        </div>
        <div className="ft-rider">
          <Rider />
        </div>
        <div className="ft-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="ft-logo" src="/fastrack-logo-wordmark.png" alt="" width="230" height="35" fetchPriority="high" />
          <p className="ft-tag">Everything you need. Delivered.</p>
          <div className="ft-dots">
            <i />
            <i />
            <i />
          </div>
        </div>
      </div>
    </>
  );
}

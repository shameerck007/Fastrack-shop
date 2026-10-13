/**
 * The loading screen for the first moments after the app is opened from the phone's icon (or the site is opened fresh).
 * The phone's own splash image (white, logo in the middle) is followed by this one, which starts as the same picture and then
 * comes alive: the logo, then a FasTrack delivery rider on a scooter riding through a scrolling city (the world moves, the
 * rider stays, so it always rides forward), the tagline and three pulsing dots. The rider is drawn here as SVG rather than an
 * emoji, so it looks the same on every phone and always faces the way it travels. It is plain HTML and CSS that arrives with
 * the very first bytes of the page, so it shows long before the app's scripts have loaded. SplashGate (client) fades it out
 * once the app has started. It is skipped for the rest of a browsing session after the first time.
 */
const CSS = `
html.no-splash #ft-splash{display:none}
#ft-splash{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff;color:#002050;transition:opacity .4s ease,visibility .4s ease}
#ft-splash.ft-out{opacity:0;visibility:hidden;pointer-events:none}
#ft-splash .ft-logo{width:min(58vw,240px);height:auto;display:block}
#ft-splash .ft-scene{position:relative;width:min(84vw,330px);height:128px;margin-top:26px;overflow:hidden;border-radius:18px;background:linear-gradient(180deg,#f3f9ff 0%,#fff 78%)}
#ft-splash .ft-layer{position:absolute;left:0;display:flex;width:200%}
#ft-splash .ft-layer svg{flex:0 0 50%;width:50%;height:auto;display:block}
#ft-splash .ft-far{bottom:26px;animation:ft-scroll 12s linear infinite}
#ft-splash .ft-near{bottom:22px;animation:ft-scroll 3.2s linear infinite}
#ft-splash .ft-road{position:absolute;left:0;right:0;bottom:0;height:24px;background:#e8f1fb}
#ft-splash .ft-dash{position:absolute;left:0;bottom:9px;height:3px;width:200%;background:repeating-linear-gradient(90deg,#fff 0 26px,transparent 26px 52px);animation:ft-scroll 1s linear infinite}
#ft-splash .ft-rider{position:absolute;left:50%;bottom:15px;width:124px;margin-left:-62px;animation:ft-bob .42s ease-in-out infinite alternate}
#ft-splash .ft-rider svg{display:block;width:100%;height:auto;overflow:visible}
#ft-splash .ft-spin{transform-box:fill-box;transform-origin:center;animation:ft-wheel .55s linear infinite}
#ft-splash .ft-wind{transform-box:fill-box;transform-origin:right center;animation:ft-wind .7s ease-out infinite}
#ft-splash .ft-wind.b{animation-delay:.23s}
#ft-splash .ft-wind.c{animation-delay:.46s}
#ft-splash .ft-puff{transform-box:fill-box;transform-origin:center;animation:ft-puff 1.1s ease-out infinite}
#ft-splash .ft-puff.b{animation-delay:.55s}
#ft-splash .ft-tag{margin-top:18px;font:600 14px/1.3 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.01em;color:#005fb0;opacity:0;animation:ft-fade .6s ease .5s forwards}
#ft-splash .ft-dots{display:flex;gap:7px;margin-top:20px}
#ft-splash .ft-dots i{width:8px;height:8px;border-radius:50%;background:#0070d0;opacity:.25;animation:ft-dot 1.2s ease-in-out infinite}
#ft-splash .ft-dots i:nth-child(2){animation-delay:.18s}
#ft-splash .ft-dots i:nth-child(3){animation-delay:.36s}
@keyframes ft-scroll{to{transform:translateX(-50%)}}
@keyframes ft-bob{from{transform:translateY(0)}to{transform:translateY(-2.5px)}}
@keyframes ft-wheel{to{transform:rotate(360deg)}}
@keyframes ft-wind{0%{opacity:0;transform:translateX(10px) scaleX(.2)}30%{opacity:.8}100%{opacity:0;transform:translateX(-26px) scaleX(1)}}
@keyframes ft-puff{0%{opacity:.55;transform:translateX(0) scale(.4)}100%{opacity:0;transform:translateX(-34px) scale(1.6)}}
@keyframes ft-fade{to{opacity:1}}
@keyframes ft-dot{0%,100%{opacity:.25;transform:scale(1)}50%{opacity:1;transform:scale(1.25)}}
@media (prefers-reduced-motion:reduce){#ft-splash .ft-far,#ft-splash .ft-near,#ft-splash .ft-dash,#ft-splash .ft-rider,#ft-splash .ft-spin,#ft-splash .ft-wind,#ft-splash .ft-puff,#ft-splash .ft-dots i{animation:none}}
`;

// Buildings of the far skyline as [x, y, width, height] in a 320 x 70 box; the strip repeats seamlessly.
const BUILDINGS: [number, number, number, number][] = [
  [0, 34, 16, 36], [18, 18, 18, 52], [38, 40, 14, 30], [54, 24, 20, 46], [76, 42, 12, 28], [90, 14, 16, 56], [108, 34, 18, 36],
  [128, 26, 14, 44], [144, 44, 12, 26], [158, 20, 20, 50], [180, 36, 14, 34], [196, 12, 16, 58], [214, 38, 16, 32], [232, 28, 14, 42],
  [248, 44, 12, 26], [262, 18, 20, 52], [284, 34, 14, 36], [300, 26, 20, 44],
];

function Skyline() {
  return (
    <svg viewBox="0 0 320 70" preserveAspectRatio="none" aria-hidden="true">
      {BUILDINGS.map(([x, y, w, h], i) => (
        <g key={i}>
          <rect x={x} y={y} width={w} height={h} rx="2" fill={i % 3 === 0 ? "#cfe3f8" : i % 3 === 1 ? "#dcebfa" : "#bcd8f3"} />
          {w >= 14 && [0, 1, 2].map((r) => <rect key={r} x={x + 3} y={y + 6 + r * 9} width={w - 6} height="2.4" rx="1" fill="#fff" opacity=".7" />)}
        </g>
      ))}
    </svg>
  );
}

function Posts() {
  return (
    <svg viewBox="0 0 320 44" preserveAspectRatio="none" aria-hidden="true">
      {[30, 110, 190, 270].map((x) => (
        <g key={x}>
          <rect x={x} y="8" width="2.6" height="36" rx="1" fill="#9db9d6" />
          <path d={`M${x + 1.3} 9 q10 -1 12 5`} stroke="#9db9d6" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <circle cx={x + 13} cy="15" r="2.6" fill="#ffd54a" />
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
      <g stroke="#7fb6ea" strokeWidth="2.4" strokeLinecap="round">
        <line className="ft-wind" x1="-4" y1="30" x2="12" y2="30" />
        <line className="ft-wind b" x1="-12" y1="42" x2="8" y2="42" />
        <line className="ft-wind c" x1="-2" y1="54" x2="14" y2="54" />
      </g>
      <circle className="ft-puff" cx="14" cy="64" r="4" fill="#cfe3f8" />
      <circle className="ft-puff b" cx="14" cy="64" r="4" fill="#cfe3f8" />
      {/* ground shadow */}
      <ellipse cx="62" cy="80" rx="46" ry="3.2" fill="#002050" opacity=".12" />
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
        <circle cx="30" cy="68" r="11" fill="#002050" />
        <circle cx="30" cy="68" r="5" fill="#cfe3f8" />
        <g className="ft-spin"><line x1="30" y1="60" x2="30" y2="76" stroke="#0070d0" strokeWidth="2" /><line x1="22" y1="68" x2="38" y2="68" stroke="#0070d0" strokeWidth="2" /></g>
      </g>
      <g>
        <circle cx="92" cy="68" r="11" fill="#002050" />
        <circle cx="92" cy="68" r="5" fill="#cfe3f8" />
        <g className="ft-spin"><line x1="92" y1="60" x2="92" y2="76" stroke="#0070d0" strokeWidth="2" /><line x1="84" y1="68" x2="100" y2="68" stroke="#0070d0" strokeWidth="2" /></g>
      </g>
    </svg>
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ft-logo" src="/fastrack-logo-wordmark.png" alt="" width="230" height="35" fetchPriority="high" />
        <div className="ft-scene">
          <div className="ft-layer ft-far">
            <Skyline />
            <Skyline />
          </div>
          <div className="ft-layer ft-near">
            <Posts />
            <Posts />
          </div>
          <div className="ft-road">
            <span className="ft-dash" />
          </div>
          <div className="ft-rider">
            <Rider />
          </div>
        </div>
        <p className="ft-tag">Everything you need. Delivered.</p>
        <div className="ft-dots">
          <i />
          <i />
          <i />
        </div>
      </div>
    </>
  );
}

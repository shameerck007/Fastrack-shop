/**
 * The loading screen for the first moments after the app is opened from the phone's icon (or the site is opened fresh).
 * The phone's own splash image (white, logo in the middle) is followed by this one, which starts as the same picture and then
 * comes alive: the logo, a delivery scooter riding along a road, and the tagline. It is plain HTML and CSS that arrives with the
 * very first bytes of the page, so it shows long before the app's scripts have loaded. SplashGate (client) fades it out once the
 * app has started. It is skipped for the rest of a browsing session after the first time, so moving between pages never repeats it.
 */
const CSS = `
html.no-splash #ft-splash{display:none}
#ft-splash{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;background:#fff;color:#002050;transition:opacity .4s ease,visibility .4s ease}
#ft-splash.ft-out{opacity:0;visibility:hidden;pointer-events:none}
#ft-splash .ft-logo{width:min(58vw,240px);height:auto;display:block}
#ft-splash .ft-road{position:relative;width:min(62vw,280px);height:46px;margin-top:34px}
#ft-splash .ft-line{position:absolute;left:0;right:0;bottom:6px;height:3px;border-radius:3px;background:repeating-linear-gradient(90deg,#0070d0 0 14px,transparent 14px 24px);opacity:.35;animation:ft-road .9s linear infinite}
#ft-splash .ft-bike{position:absolute;bottom:9px;left:0;font-size:30px;line-height:1;animation:ft-ride 2.4s cubic-bezier(.45,.05,.4,.95) infinite;filter:drop-shadow(0 4px 4px rgba(0,32,80,.18))}
#ft-splash .ft-tag{margin-top:18px;font:600 14px/1.3 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.01em;color:#005fb0;opacity:0;animation:ft-fade .6s ease .5s forwards}
#ft-splash .ft-dots{display:flex;gap:7px;margin-top:22px}
#ft-splash .ft-dots i{width:8px;height:8px;border-radius:50%;background:#0070d0;opacity:.25;animation:ft-dot 1.2s ease-in-out infinite}
#ft-splash .ft-dots i:nth-child(2){animation-delay:.18s}
#ft-splash .ft-dots i:nth-child(3){animation-delay:.36s}
@keyframes ft-ride{0%{transform:translateX(-8%)}100%{transform:translateX(calc(min(62vw,280px) - 34px))}}
@keyframes ft-road{to{background-position:-24px 0}}
@keyframes ft-fade{to{opacity:1}}
@keyframes ft-dot{0%,100%{opacity:.25;transform:scale(1)}50%{opacity:1;transform:scale(1.25)}}
@media (prefers-reduced-motion:reduce){#ft-splash .ft-line,#ft-splash .ft-bike,#ft-splash .ft-dots i{animation:none}#ft-splash .ft-bike{left:calc(50% - 15px)}}
`;

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
        <div className="ft-road">
          <span className="ft-line" />
          <span className="ft-bike">🛵</span>
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

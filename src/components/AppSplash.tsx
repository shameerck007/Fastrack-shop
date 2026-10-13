/**
 * The loading screen for the first moments after the app is opened from the phone's icon (or the site is opened fresh).
 * The phone's own splash image (white, logo in the middle) is followed by this one, which starts as the same picture and then
 * comes alive: the logo, then a photo of a FasTrack rider speeding through the city at night, brought to life with a slow
 * push-in, a sweep of light, speed streaks and road markings rushing past, then the tagline and three pulsing dots. It is
 * plain HTML and CSS that arrives with the very first bytes of the page, so it shows long before the app's scripts have
 * loaded. SplashGate (client) fades it out once the app has started. It is skipped for the rest of a browsing session after
 * the first time.
 */
const CSS = `
html.no-splash #ft-splash{display:none}
#ft-splash{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff;color:#002050;transition:opacity .4s ease,visibility .4s ease}
#ft-splash.ft-out{opacity:0;visibility:hidden;pointer-events:none}
#ft-splash .ft-logo{width:min(52vw,220px);height:auto;display:block}
#ft-splash .ft-scene{position:relative;width:min(92vw,560px);aspect-ratio:804/280;margin-top:22px;overflow:hidden;border-radius:18px;background:#0b1730;box-shadow:0 14px 40px -12px rgba(0,32,80,.45);opacity:0;transform:translateY(10px);animation:ft-in .6s ease .1s forwards}
#ft-splash .ft-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform-origin:46% 72%;animation:ft-push 9s ease-out forwards,ft-sway .5s ease-in-out infinite alternate}
#ft-splash .ft-shade{position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 60%,transparent 55%,rgba(0,10,32,.45) 100%)}
#ft-splash .ft-sweep{position:absolute;top:-20%;bottom:-20%;width:34%;left:-40%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.28),transparent);transform:skewX(-18deg);animation:ft-sweep 2.8s ease-in-out .5s infinite}
#ft-splash .ft-streaks{position:absolute;left:0;right:0;bottom:0;height:34%;overflow:hidden}
#ft-splash .ft-streaks i{position:absolute;left:100%;height:2px;border-radius:2px;background:linear-gradient(90deg,transparent,rgba(190,225,255,.9));animation:ft-streak .9s linear infinite}
#ft-splash .ft-streaks i:nth-child(1){top:18%;width:34%;animation-delay:0s}
#ft-splash .ft-streaks i:nth-child(2){top:38%;width:46%;animation-delay:.3s;animation-duration:.75s}
#ft-splash .ft-streaks i:nth-child(3){top:58%;width:30%;animation-delay:.55s}
#ft-splash .ft-streaks i:nth-child(4){top:78%;width:52%;animation-delay:.15s;animation-duration:.65s}
#ft-splash .ft-streaks i:nth-child(5){top:48%;width:24%;animation-delay:.7s;animation-duration:.8s}
#ft-splash .ft-dash{position:absolute;left:0;bottom:3%;height:3px;width:200%;background:repeating-linear-gradient(90deg,rgba(255,255,255,.75) 0 34px,transparent 34px 80px);animation:ft-road .7s linear infinite}
#ft-splash .ft-tag{margin-top:20px;font:600 14px/1.3 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.01em;color:#005fb0;opacity:0;animation:ft-fade .6s ease .6s forwards}
#ft-splash .ft-dots{display:flex;gap:7px;margin-top:18px}
#ft-splash .ft-dots i{width:8px;height:8px;border-radius:50%;background:#0070d0;opacity:.25;animation:ft-dot 1.2s ease-in-out infinite}
#ft-splash .ft-dots i:nth-child(2){animation-delay:.18s}
#ft-splash .ft-dots i:nth-child(3){animation-delay:.36s}
@keyframes ft-in{to{opacity:1;transform:none}}
@keyframes ft-push{from{scale:1.02}to{scale:1.16}}
@keyframes ft-sway{from{translate:0 0}to{translate:0 -1.5px}}
@keyframes ft-sweep{0%{left:-40%}60%,100%{left:120%}}
@keyframes ft-streak{from{transform:translateX(0)}to{transform:translateX(-420%)}}
@keyframes ft-road{to{transform:translateX(-40px)}}
@keyframes ft-fade{to{opacity:1}}
@keyframes ft-dot{0%,100%{opacity:.25;transform:scale(1)}50%{opacity:1;transform:scale(1.25)}}
@media (prefers-reduced-motion:reduce){#ft-splash .ft-photo,#ft-splash .ft-sweep,#ft-splash .ft-streaks i,#ft-splash .ft-dash,#ft-splash .ft-dots i{animation:none}#ft-splash .ft-scene,#ft-splash .ft-tag{opacity:1;transform:none;animation:none}}
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
        <div className="ft-scene">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="ft-photo" src="/splash-city-rider.jpg" alt="" width="804" height="280" fetchPriority="high" />
          <div className="ft-shade" />
          <div className="ft-sweep" />
          <div className="ft-streaks">
            <i /><i /><i /><i /><i />
            <span className="ft-dash" />
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

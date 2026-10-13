/**
 * The map pin used everywhere on the maps: a classic teardrop in the logo's deep navy with a white centre and a thin white edge,
 * so it stays clear on any map colour. `PIN_ICON` replaces Leaflet's stock blue marker; `pinHtml` is the same pin with a small
 * picture (the shop, the home) in its centre, for the live order maps.
 */
const NAVY = "#002050";

const BODY = `<path d="M17 1.5C8.4 1.5 1.5 8.3 1.5 16.8c0 11 12.6 26 14.7 27.5.5.4 1.3.4 1.7 0C20 42.8 32.5 27.8 32.5 16.8 32.5 8.3 25.6 1.5 17 1.5z" fill="${NAVY}" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/>`;

const svg = (centre: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 46" width="34" height="46"><ellipse cx="17" cy="44.2" rx="7" ry="1.6" fill="#000" opacity=".22"/>${BODY}${centre}</svg>`;

const PLAIN = svg(`<circle cx="17" cy="16.8" r="6.6" fill="#fff"/>`);

/** For L.icon(): the plain pin, tip at the bottom centre. */
export const PIN_ICON = {
  iconUrl: `data:image/svg+xml;utf8,${encodeURIComponent(PLAIN)}`,
  iconSize: [34, 46] as [number, number],
  iconAnchor: [17, 45] as [number, number],
  popupAnchor: [0, -40] as [number, number],
};

/** For L.divIcon({ html, iconSize: PIN_SIZE, iconAnchor: PIN_ANCHOR }): the pin with an emoji in a white circle. */
export const PIN_SIZE: [number, number] = [34, 46];
export const PIN_ANCHOR: [number, number] = [17, 45];
export function pinHtml(emoji: string): string {
  return (
    `<div style="position:relative;width:34px;height:46px;filter:drop-shadow(0 3px 4px rgba(0,32,80,.35))">` +
    svg(`<circle cx="17" cy="16.8" r="9" fill="#fff"/>`).replace('<ellipse cx="17" cy="44.2" rx="7" ry="1.6" fill="#000" opacity=".22"/>', "") +
    `<span style="position:absolute;left:0;right:0;top:7px;text-align:center;font-size:15px;line-height:19px">${emoji}</span>` +
    `</div>`
  );
}

/** The same pin as a tiny inline picture for text built as an HTML string (map popups); it takes the surrounding text size. */
export const PIN_INLINE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 46" width="9" height="12" style="display:inline-block;vertical-align:-1px"><path d="M17 1.5C8.4 1.5 1.5 8.3 1.5 16.8c0 11 12.6 26 14.7 27.5.5.4 1.3.4 1.7 0C20 42.8 32.5 27.8 32.5 16.8 32.5 8.3 25.6 1.5 17 1.5z" fill="${NAVY}" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/><circle cx="17" cy="16.8" r="6.6" fill="#fff"/></svg>`;

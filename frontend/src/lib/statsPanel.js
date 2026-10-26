/**
 * The stats panel, the audience's overlay (Task #3164; Evoni, 2026-10-14):
 * separate from Lala's Phone. The art is one of the show's overlays (Assets
 * → Overlays), 1920 × 220 with a transparent background and the 1600 × 180
 * design centred. Its number boxes are { id, stat, x, y, w, h, icon, color },
 * in percent of the art; each number reads "before → after" for an episode
 * (services/statsPanelService on the server, which also draws the PNG).
 */
import api from '../services/api';

export const PANEL_STATS = [
  { key: 'coins', label: 'Coins' },
  { key: 'reputation', label: 'Reputation' },
  { key: 'influence', label: 'Influence' },
  { key: 'followers', label: 'Followers' },
  // Lower is better (Evoni, 2026-10-25): with no colour of its own the
  // number is green when it fell and rose-red when it rose
  // (services/statsPanelService spotTexts).
  { key: 'stress', label: 'Stress', lowerIsBetter: true },
];

/** The master's shape: the PNG is 1920 × 220 (or twice that for 4K). */
export const PANEL_ASPECT = 1920 / 220;
export const PANEL_SIZES = [
  { key: '1080p', label: 'YouTube 1080p', dims: '1920 × 220' },
  { key: '4k', label: 'YouTube 4K', dims: '3840 × 440' },
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = (v) => Math.round(v * 10) / 10;

/** A new box, laid left to right inside the 1600 × 180 design (x 8.3–91.7%, y 9–91%). */
export function newSpot(n = 0) {
  const stat = PANEL_STATS[n % PANEL_STATS.length].key;
  return { id: `spot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, stat, x: round(10 + (n % 4) * 20), y: 25, w: 18, h: 50, icon: null, color: null };
}

/** A box moved by (dx, dy) percent, kept on the art. */
export function moveSpot(spot, dx, dy) {
  return { ...spot, x: round(clamp(spot.x + dx, 0, 100 - spot.w)), y: round(clamp(spot.y + dy, 0, 100 - spot.h)) };
}

/** A box resized by (dw, dh) percent, at least 2% and kept on the art. */
export function resizeSpot(spot, dw, dh) {
  return { ...spot, w: round(clamp(spot.w + dw, 2, 100 - spot.x)), h: round(clamp(spot.h + dh, 2, 100 - spot.y)) };
}

const base = (showId) => `/api/v1/ui-overlays/${showId}/stats-panel`;

export const statsPanelApi = {
  save: (showId, assetId, spots) => api.put(`${base(showId)}/${assetId}`, { spots }).then((r) => r.data?.data),
  episode: (showId, episodeId) => api.get(`${base(showId)}/episode/${episodeId}`).then((r) => r.data?.data),
  async download(showId, episodeId, size, episodeNumber) {
    const res = await api.get(`${base(showId)}/episode/${episodeId}/png?size=${encodeURIComponent(size)}`, { responseType: 'blob' });
    const disposition = res.headers?.['content-disposition'] || '';
    const n = episodeNumber != null ? String(episodeNumber).padStart(2, '0') : 'episode';
    const name = /filename="([^"]+)"/.exec(disposition)?.[1] || `stats-panel-episode-${n}-${size}.png`;
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

/** Each icon key's current image among the show's overlays. */
export const iconUrlsOf = (overlays) => Object.fromEntries((overlays || []).filter((o) => o.url).map((o) => [o.id, o.url]));

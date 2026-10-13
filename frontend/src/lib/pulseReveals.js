/**
 * Reveals on The Pulse for screens (Task 2939; The Pulse spec §5;
 * src/services/pulseReveals.js). Lala's view reads each item as of the
 * present and the server leaves hidden items out; these helpers fetch the
 * two things the page needs besides: the Dream Cities' image states and
 * teaser images (their own URLs come from page-content, so the page swaps in
 * the teaser, withCityTeasers) and, in Director view, each item's reveal
 * label for its chip.
 */
import api from '../services/api';

/** The key an item's reveal is found by: type, image kind (images only) and id. */
export const revealKey = (type, id, kind = '') => `${type}:${kind || ''}:${id}`;

/** Director view: Map revealKey → label ("During Ep 3"), or "not placed yet" when its episode is unknown. */
export async function loadRevealLabels(showId) {
  const res = await api.get(`/api/v1/pulse-reveals?show_id=${encodeURIComponent(showId)}`);
  const map = new Map();
  for (const r of res.data?.reveals || []) {
    if (r.item_type === 'character') continue;
    map.set(revealKey(r.item_type, r.item_id, r.image_kind), r.label || 'not placed yet');
  }
  return map;
}

/**
 * Lala's view: the cities' reveals at the present (or `at`, a story order):
 * states { 'city:<key>' | 'city_bubble:<key>': 'teaser' | 'hidden' } and
 * teasers { same keys: the teaser image's URL, or null } (Task 3034).
 */
export async function loadCityReveals(showId, at = 'present') {
  const res = await api.get(`/api/v1/pulse-reveals/state?show_id=${encodeURIComponent(showId)}&at=${encodeURIComponent(at)}`);
  return { states: res.data?.cities || {}, teasers: res.data?.teasers || {} };
}

/** The states alone: { 'city:<key>' | 'city_bubble:<key>': 'teaser' | 'hidden' }. */
export async function loadCityStates(showId, at = 'present') {
  return (await loadCityReveals(showId, at)).states;
}

/**
 * The cities as Lala sees them (Task 3034): a first look's image is its
 * teaser, cut by the server, in place of the city's own image or story
 * bubble; with no teaser image, none; a hidden image, none.
 */
export function withCityTeasers(cities, { states = {}, teasers = {} } = {}) {
  return (cities || []).map((city) => {
    const out = { ...city };
    for (const [kind, field] of [['city', 'image_url'], ['city_bubble', 'bubble_image_url']]) {
      const key = `${kind}:${city.key}`;
      if (states[key] === 'teaser') out[field] = teasers[key] || null;
      if (states[key] === 'hidden') out[field] = null;
    }
    return out;
  });
}

/**
 * Reveals on The Pulse for screens (Task 2939; The Pulse spec §5;
 * src/services/pulseReveals.js). Lala's view reads each item as of the
 * present and the server leaves hidden items out; these helpers fetch the
 * two things the page needs besides: the Dream Cities' image states (their
 * URLs come from page-content) and, in Director view, each item's reveal
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

/** Lala's view: { 'city:<key>' | 'city_bubble:<key>': 'teaser' | 'hidden' } at the present (or `at`, a story order). */
export async function loadCityStates(showId, at = 'present') {
  const res = await api.get(`/api/v1/pulse-reveals/state?show_id=${encodeURIComponent(showId)}&at=${encodeURIComponent(at)}`);
  return res.data?.cities || {};
}

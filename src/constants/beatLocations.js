/**
 * Where each of the 14 beats happens, and which kind of angle it asks for
 * (Evoni's ruling L4 and her answers Q17 and Q18, 2026-10-02;
 * docs/EVENT_EPISODE_FLOW.md §8(hh)).
 *
 *   L4. "The episode's scene planner suggests each location's angles for
 *   the beats (e.g. arrival → entrance/exterior, the event → main
 *   interior). A missing angle shows a specific action."
 *   Q17. "each beat's usual location becomes its role. TRANSITION beats 7
 *   and 9 go to home; beat 10 (Event Travel) is 'arrival' and goes to the
 *   event's exterior or entrance."
 *   Q18. "a new angle_kind field (exterior, entrance, main interior, …)
 *   beside the free label, filled for existing angles from their labels
 *   (ESTABLISHING → exterior, DOORWAY → entrance, WIDE → main interior)."
 *
 * L14 (Evoni, 2026-10-02, with her answers 1-9): "A scene set's angles are
 * organised as zones of the place, not camera framings: Front (exterior,
 * entrance, arrival), Inside (the main room), Back (backstage, private or
 * quiet area), plus the Venue Look's event areas; home sets use their own
 * zones ... Close-up or other framings are optional extras on a zone ...
 * Beats map to zones (arrival → Front, the event → Inside, private or
 * reflective moments → Back)." Answer 1: Inside is the set's base, so a
 * beat that asks for Inside uses an Inside angle with an image, else the
 * base, and is never missing. Answer 4: no beat is fixed to Back.
 *
 * The role comes from CANONICAL_BEATS' typical_location (HOME_BASE → home,
 * CLOSET → closet, EVENT_LOCATION → event; TRANSITION by Q17). kinds: the
 * zones the beat asks for, first preferred; [] asks for none (any of the
 * set's angles, or its base image).
 */
const { CANONICAL_BEATS } = require('./canonicalBeats');

// L14: the zones, and 'extra' for a framing on a zone (zone_angle_id; none =
// Inside). Migration 20261002170000 re-kinds the Q18 kinds.
const ZONE_KINDS = Object.freeze(['front', 'inside', 'back', 'area', 'zone']);
const ANGLE_KINDS = Object.freeze([...ZONE_KINDS, 'extra']);
const ANGLE_KIND_LABELS = Object.freeze({
  front: 'Front',
  inside: 'Inside',
  back: 'Back',
  area: 'Event area',
  zone: 'Zone',
  extra: 'Extra framing',
});
// The kind a suggested angle gets from its label, and the label a new angle
// of each kind is created with.
const KIND_FROM_LABEL = Object.freeze({ ESTABLISHING: 'front', DOORWAY: 'front', WIDE: 'inside' });
const LABEL_FOR_KIND = Object.freeze({ front: 'ESTABLISHING', inside: 'WIDE', back: 'OTHER', area: 'OTHER', zone: 'OTHER', extra: 'CLOSE' });
// Answer 1: Inside is the set's base image.
const BASE_KINDS = Object.freeze(['inside']);

const ROLE_BY_LOCATION = Object.freeze({ HOME_BASE: 'home', CLOSET: 'closet', EVENT_LOCATION: 'event' });
const TRANSITION_ROLE = Object.freeze({ 7: 'home', 9: 'home', 10: 'event' });
const BEAT_KINDS = Object.freeze({
  10: ['front'], // arrival
  11: ['inside'], // the event
  12: ['inside'],
});

const BEAT_LOCATIONS = Object.freeze(Object.fromEntries(CANONICAL_BEATS.map((b) => [b.number, Object.freeze({
  role: b.typical_location === 'TRANSITION' ? (TRANSITION_ROLE[b.number] || 'home') : (ROLE_BY_LOCATION[b.typical_location] || 'home'),
  kinds: Object.freeze([...(BEAT_KINDS[b.number] || [])]),
})])));

/** "Front", or "Front or back", for a beat's kinds. */
function kindsText(kinds) {
  const names = (kinds || []).map((k) => ANGLE_KIND_LABELS[k] || k);
  if (names.length < 2) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1].toLowerCase()}`;
}

/** "zone" for a zone kind, "angle" for an extra. */
function kindNoun(kinds) {
  return (kinds || []).some((k) => ZONE_KINDS.includes(k)) ? 'zone' : 'angle';
}

module.exports = {
  ZONE_KINDS,
  BASE_KINDS,
  ANGLE_KINDS,
  ANGLE_KIND_LABELS,
  KIND_FROM_LABEL,
  LABEL_FOR_KIND,
  BEAT_LOCATIONS,
  kindsText,
  kindNoun,
};

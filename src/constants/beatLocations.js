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
 * The role comes from CANONICAL_BEATS' typical_location (HOME_BASE → home,
 * CLOSET → closet, EVENT_LOCATION → event; TRANSITION by Q17). kinds: the
 * angle kinds the beat asks for, first preferred; [] asks for none (any of
 * the set's angles, or its base image).
 */
const { CANONICAL_BEATS } = require('./canonicalBeats');

const ANGLE_KINDS = Object.freeze(['exterior', 'entrance', 'main_interior', 'area', 'detail', 'other']);
const ANGLE_KIND_LABELS = Object.freeze({
  exterior: 'Exterior',
  entrance: 'Entrance',
  main_interior: 'Main interior',
  area: 'Event area',
  detail: 'Detail',
  other: 'Other',
});
// Q18's backfill, and the label a new angle of each kind is created with.
const KIND_FROM_LABEL = Object.freeze({ ESTABLISHING: 'exterior', DOORWAY: 'entrance', WIDE: 'main_interior' });
const LABEL_FOR_KIND = Object.freeze({ exterior: 'ESTABLISHING', entrance: 'DOORWAY', main_interior: 'WIDE', area: 'OTHER', detail: 'CLOSE', other: 'OTHER' });

const ROLE_BY_LOCATION = Object.freeze({ HOME_BASE: 'home', CLOSET: 'closet', EVENT_LOCATION: 'event' });
const TRANSITION_ROLE = Object.freeze({ 7: 'home', 9: 'home', 10: 'event' });
const BEAT_KINDS = Object.freeze({
  10: ['entrance', 'exterior'], // arrival
  11: ['main_interior'], // the event
  12: ['main_interior'],
});

const BEAT_LOCATIONS = Object.freeze(Object.fromEntries(CANONICAL_BEATS.map((b) => [b.number, Object.freeze({
  role: b.typical_location === 'TRANSITION' ? (TRANSITION_ROLE[b.number] || 'home') : (ROLE_BY_LOCATION[b.typical_location] || 'home'),
  kinds: Object.freeze([...(BEAT_KINDS[b.number] || [])]),
})])));

/** "Entrance or exterior" for a beat's kinds. */
function kindsText(kinds) {
  const names = (kinds || []).map((k) => ANGLE_KIND_LABELS[k] || k);
  if (names.length < 2) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1].toLowerCase()}`;
}

module.exports = {
  ANGLE_KINDS,
  ANGLE_KIND_LABELS,
  KIND_FROM_LABEL,
  LABEL_FOR_KIND,
  BEAT_LOCATIONS,
  kindsText,
};

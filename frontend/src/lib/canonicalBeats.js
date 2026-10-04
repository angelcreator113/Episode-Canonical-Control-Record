/**
 * The 14 canonical beats for pickers (2026-10-04). Mirrors
 * src/constants/canonicalBeats.js (CANONICAL_BEATS: number, name, and
 * whether the beat's surface is Lala's Phone); the backend test
 * tests/unit/constants/frontend-canonical-beats.test.js keeps the two in
 * step.
 */
export const BEATS = [
  { number: 1, name: 'Opening Ritual', phone: false },
  { number: 2, name: 'Login Sequence', phone: false },
  { number: 3, name: 'Welcome', phone: false },
  { number: 4, name: 'Interruption Pulse 1', phone: true },
  { number: 5, name: 'Reveal', phone: true },
  { number: 6, name: 'Strategic Reaction', phone: false },
  { number: 7, name: 'Interruption Pulse 2', phone: true },
  { number: 8, name: 'Transformation Loop', phone: true },
  { number: 9, name: 'Reminder/Deadline', phone: true },
  { number: 10, name: 'Event Travel', phone: true },
  { number: 11, name: 'Event Outcome', phone: false },
  { number: 12, name: 'Deliverable Creation', phone: true },
  { number: 13, name: 'Recap Panel', phone: false },
  { number: 14, name: 'Cliffhanger', phone: false },
];

export const beatName = (n) => BEATS.find((b) => b.number === Number(n))?.name || `Beat ${n}`;

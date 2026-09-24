/**
 * Event category and format (Task #1780) — the values an event may take,
 * and how the Event Package's Basics shows each one.
 *
 * The allowed values are WorldEvent's validate.isIn lists
 * (src/models/WorldEvent.js), which the frontend cannot import. They are
 * mirrored in constants/eventTaxonomy.json, and
 * tests/unit/models/WorldEvent.taxonomyMirror.test.js fails if the mirror
 * and the model ever disagree. Change the model first, then the JSON.
 *
 * Both fields are set or missing, never suggested: nothing on the event
 * says what its category or format should be (format is itself the input
 * the time and dress-code suggestions read, eventBasics.js).
 *
 * The event PUT writes with raw SQL, so the model's isIn does not run
 * there; a stored value outside the list is possible. It is shown as set
 * (readiness counts any text) and flagged, never silently dropped.
 *
 * Pure; no I/O.
 */
import taxonomy from '../constants/eventTaxonomy.json';

export const EVENT_CATEGORIES = Object.freeze([...taxonomy.category]);
export const EVENT_FORMATS = Object.freeze([...taxonomy.format]);

const text = (v) => (typeof v === 'string' ? v.trim() : '');

// "brunch_dining" → "Brunch Dining".
export function taxonomyLabel(value) {
  const v = text(value);
  if (!v) return '';
  return v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * One Basics field for category or format.
 * Returns { state: 'set' | 'missing', value, inList }.
 * inList is false only for a stored value the model would not allow.
 */
export function resolveTaxonomyField(value, allowed) {
  const v = text(value);
  if (!v) return { state: 'missing', value: null, inList: true };
  return { state: 'set', value: v, inList: allowed.includes(v) };
}

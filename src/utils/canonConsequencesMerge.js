'use strict';

/**
 * mergeCanonConsequences — how PUT /world/:showId/events/:eventId combines
 * the canon_consequences a sender sends with the one already stored
 * (Task #1747). Pure; no I/O.
 *
 * Depth: two levels, no deeper.
 *   - Top level: keys the sender omits keep their stored value.
 *   - `automation`: merged key by key the same way, because every editor
 *     that sends canon_consequences sends an `automation` block, so a
 *     top-level-only merge would still replace automation wholesale.
 *   - Everything below that (a guest_profiles array, the invitation_text
 *     object, the declined record, ...) is a value: the sender's copy
 *     replaces the stored one whole. Arrays are never concatenated.
 *
 * Removal: a key sent with the value null is deleted (at the top level or
 * inside automation). Sending `automation: null` deletes the automation
 * block. The whole-column null case never reaches this helper — the
 * route writes SQL NULL for it, as before.
 *
 * If either side is not a plain object (a string, an array, a number) the
 * incoming value is returned unchanged, i.e. the old replace behaviour.
 */

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Stored JSONB normally arrives parsed; tolerate a JSON string too.
function parseStored(stored) {
  if (typeof stored === 'string') {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('[canonConsequencesMerge] stored canon_consequences is not valid JSON; treating as empty:', e.message);
      return null;
    }
  }
  return stored;
}

// Shallow merge of one level: incoming keys win, null deletes.
function mergeLevel(base, incoming) {
  const out = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    if (value === null) delete out[key];
    else out[key] = value;
  }
  return out;
}

function mergeCanonConsequences(stored, incoming) {
  if (!isPlainObject(incoming)) return incoming;

  const parsed = parseStored(stored);
  const base = isPlainObject(parsed) ? parsed : {};

  const merged = mergeLevel(base, incoming);

  if (isPlainObject(incoming.automation) && isPlainObject(base.automation)) {
    merged.automation = mergeLevel(base.automation, incoming.automation);
  } else if (isPlainObject(incoming.automation)) {
    // Nothing (or a non-object) stored: still drop null keys so the
    // removal rule reads the same whatever was there before.
    merged.automation = mergeLevel({}, incoming.automation);
  }

  return merged;
}

module.exports = { mergeCanonConsequences };

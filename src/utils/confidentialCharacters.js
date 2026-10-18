'use strict';

/**
 * Confidential professionals stay out of the writers (Evoni, 2026-10-18,
 * on Dr. Amara Sinclair: "a special Confidential Professional character
 * classification, so she doesn't get ordinary character behaviors like
 * randomly posting about clients, sharing private information, or
 * appearing in an event without a story reason").
 *
 * A confidential professional is a registry character whose
 * extra_fields.classification is 'confidential_professional' (Dr. Sinclair,
 * character_key 'amara_sinclair', added by migration
 * 20261018150000-character-conversations). A writer, generator or picker
 * that chooses characters by itself leaves them out; one the author points
 * at by name or id (a chapter's characters present, a scene's keys) and the
 * pages where she manages characters still show them.
 *
 *   isConfidential(character)      for a row (plain or instance); extra_fields
 *                                  may be a JSON string, or not loaded (the
 *                                  key still tells)
 *   withoutConfidential(list)      the list without them
 *   notConfidentialSql(alias)      a SQL condition keeping them out
 */

const CONFIDENTIAL = 'confidential_professional';
const CONFIDENTIAL_KEYS = Object.freeze(['amara_sinclair']);

function extraOf(character) {
  const raw = typeof character?.get === 'function' ? character.get('extra_fields') : character?.extra_fields;
  if (!raw) return {};
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch (err) {
    console.error('[confidentialCharacters] extra_fields is not JSON:', err.message);
    return {};
  }
}

function isConfidential(character) {
  if (!character) return false;
  const key = typeof character.get === 'function' ? character.get('character_key') : character.character_key;
  return CONFIDENTIAL_KEYS.includes(key) || extraOf(character).classification === CONFIDENTIAL;
}

const withoutConfidential = (list) => (Array.isArray(list) ? list.filter((c) => !isConfidential(c)) : list);

function notConfidentialSql(alias = 'rc') {
  const a = alias ? `${alias}.` : '';
  return `(COALESCE(${a}extra_fields->>'classification', '') <> '${CONFIDENTIAL}' AND COALESCE(${a}character_key, '') NOT IN (${CONFIDENTIAL_KEYS.map((k) => `'${k}'`).join(', ')}))`;
}

module.exports = { CONFIDENTIAL, CONFIDENTIAL_KEYS, isConfidential, withoutConfidential, notConfidentialSql };

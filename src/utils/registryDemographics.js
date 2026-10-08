'use strict';

/**
 * Values for registry_characters.current_city and relationship_status,
 * two ENUM columns that refuse anything off their lists. On a migrated
 * database "echo_park", "Echo Park", "a loft above a club in Echo Park",
 * "engaged" and "its_complicated" each fail the insert, so World Studio's
 * sync, which copied a character's free-text location and its own status
 * words across, failed for nearly every character.
 *
 * current_city holds the five DREAM cities (migration
 * 20261008150000-registry-characters-dream-cities adds them and renames
 * the old five as July did for the Feed), outside_lalaverse for a
 * real-world character, or unknown.
 */

const { DREAM_CITY_KEYS, feedCity } = require('./feedCities');
const { DREAM_CITIES } = require('./lalaHome');

const keyOf = (value) => String(value || '').trim().toLowerCase().replace(/['’]/g, '').replace(/[\s-]+/g, '_');

const REGISTRY_CITY_KEYS = Object.freeze([...DREAM_CITY_KEYS, 'outside_lalaverse', 'unknown']);

/** A registry city for a value: a DREAM city (by key or name, an old one as July mapped it), outside_lalaverse or unknown; else null. */
function registryCity(value) {
  const key = keyOf(value);
  if (key === 'outside_lalaverse' || key === 'unknown') return key;
  return feedCity(value);
}

/** The DREAM city a text names ("a loft above a club in Echo Park"), or null when it names none or more than one. */
function cityNamedIn(text) {
  const t = ` ${String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  const named = DREAM_CITIES.filter((name) => t.includes(` ${name.toLowerCase()} `));
  return named.length === 1 ? keyOf(named[0]) : null;
}

/**
 * A World Studio character's registry city. A Book 1 character lives in
 * the real world (outside_lalaverse, as the character generator files
 * real-world characters); a LalaVerse character's is the DREAM city its
 * location names, else none.
 */
function worldCharacterCity(worldTag, location) {
  if (worldTag === 'book-1') return 'outside_lalaverse';
  return registryCity(location) || cityNamedIn(location);
}

const RELATIONSHIP_STATUSES = Object.freeze([
  'single', 'dating', 'committed', 'married', 'separated', 'divorced', 'widowed', 'complicated', 'unknown',
]);

// World Studio's words for the two the registry names otherwise.
const RELATIONSHIP_STATUS_ALIASES = Object.freeze({ engaged: 'committed', its_complicated: 'complicated' });

/** A registry relationship status for a value, else null. */
function registryRelationshipStatus(value) {
  const key = keyOf(value);
  if (RELATIONSHIP_STATUSES.includes(key)) return key;
  return RELATIONSHIP_STATUS_ALIASES[key] || null;
}

module.exports = {
  REGISTRY_CITY_KEYS,
  RELATIONSHIP_STATUSES,
  registryCity,
  cityNamedIn,
  worldCharacterCity,
  registryRelationshipStatus,
};

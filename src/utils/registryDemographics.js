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
 *
 * The registry's other demographic ENUMs are listed here too
 * (REGISTRY_ENUMS), with registryValue to read a value into one, for the
 * writers that save what an AI returns.
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

// World Studio's words (engaged, its_complicated) and the character
// generator's (partnered) for the ones the registry names otherwise.
const RELATIONSHIP_STATUS_ALIASES = Object.freeze({
  engaged: 'committed', its_complicated: 'complicated', partnered: 'committed',
});

/** A registry relationship status for a value, else null. */
function registryRelationshipStatus(value) {
  const key = keyOf(value);
  if (RELATIONSHIP_STATUSES.includes(key)) return key;
  return RELATIONSHIP_STATUS_ALIASES[key] || null;
}

const CLASS_VALUES = Object.freeze([
  'poverty', 'working_class', 'lower_middle', 'middle_class', 'upper_middle', 'wealthy', 'old_money', 'unknown',
]);

/**
 * Every demographic ENUM on registry_characters, as migration
 * 20260313200000-character-demographics made them (current_city since
 * 20261008150000). The model declares them STRING, so nothing refuses a
 * value before the database does, and one value off its list fails the
 * whole save.
 */
const REGISTRY_ENUMS = Object.freeze({
  current_city: REGISTRY_CITY_KEYS,
  class_origin: CLASS_VALUES,
  current_class: CLASS_VALUES,
  class_mobility_direction: Object.freeze(['ascending', 'descending', 'stable', 'volatile', 'unknown']),
  family_structure: Object.freeze([
    'two_parents_intact', 'single_mother', 'single_father', 'raised_by_grandparents',
    'raised_by_other_relatives', 'blended_family', 'foster_or_adopted', 'effectively_alone', 'unknown',
  ]),
  sibling_position: Object.freeze(['only_child', 'oldest', 'middle', 'youngest', 'unknown']),
  relationship_status: RELATIONSHIP_STATUSES,
  // How the character is present online, not a platform name.
  platform_primary: Object.freeze(['lalaverse_main', 'multi_platform', 'live_first', 'archive_heavy', 'unknown']),
  follower_tier: Object.freeze(['ghost', 'micro', 'mid', 'macro', 'mega', 'unknown']),
});

// The words the character generator's and the section fill-in's prompts
// asked for, read as the registry value each means. A word with more than
// one reading (single_parent, raised_by_relatives) or none (chosen_family,
// extended, a platform name such as instagram) has no entry, and is not
// saved.
const CLASS_ALIASES = Object.freeze({ destitute: 'poverty', working_poor: 'poverty', middle: 'middle_class' });
const REGISTRY_ALIASES = Object.freeze({
  class_origin: CLASS_ALIASES,
  current_class: CLASS_ALIASES,
  class_mobility_direction: Object.freeze({ upward: 'ascending', downward: 'descending' }),
  family_structure: Object.freeze({
    two_parent_stable: 'two_parents_intact', two_parent_volatile: 'two_parents_intact', nuclear: 'two_parents_intact',
    foster: 'foster_or_adopted', blended: 'blended_family',
  }),
  sibling_position: Object.freeze({ only: 'only_child', eldest: 'oldest' }),
  relationship_status: RELATIONSHIP_STATUS_ALIASES,
  follower_tier: Object.freeze({ nano: 'micro', mid_tier: 'mid' }),
});

/** The registry's value for one of its ENUM fields (REGISTRY_ENUMS): the value itself, or the one an old word means; else null. */
function registryValue(field, value) {
  if (field === 'current_city') return registryCity(value);
  const values = REGISTRY_ENUMS[field];
  if (!values) return null;
  const key = keyOf(value);
  if (values.includes(key)) return key;
  return REGISTRY_ALIASES[field]?.[key] || null;
}

/** A field's values for a prompt, without unknown: "poverty, working_class, ...". */
function registryChoices(field, separator = ', ') {
  return (REGISTRY_ENUMS[field] || []).filter((v) => v !== 'unknown').join(separator);
}

/**
 * A record with its demographic ENUM fields as the registry stores them:
 * each read by registryValue, and each it cannot read left out (and listed
 * in `skipped`, for the caller to log), so one stray value cannot fail the
 * save.
 */
function fitRegistryEnums(record) {
  const fitted = { ...record };
  const skipped = [];
  for (const field of Object.keys(REGISTRY_ENUMS)) {
    const value = record[field];
    if (value === undefined || value === null || value === '') continue;
    const stored = registryValue(field, value);
    if (stored) {
      fitted[field] = stored;
    } else {
      delete fitted[field];
      skipped.push({ field, value });
    }
  }
  return { fitted, skipped };
}

module.exports = {
  REGISTRY_CITY_KEYS,
  RELATIONSHIP_STATUSES,
  REGISTRY_ENUMS,
  registryCity,
  cityNamedIn,
  worldCharacterCity,
  registryRelationshipStatus,
  registryValue,
  registryChoices,
  fitRegistryEnums,
};

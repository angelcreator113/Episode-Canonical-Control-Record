'use strict';

/**
 * The kinds of relationship between two Feed profiles
 * (social_profile_relationships.relationship_type): the ones The Pulse reads
 * for closeness, and, since Task #3115, the ones the Relationship Map edits.
 * Orbit and Former friends came from the map (Evoni, 2026-10-13: "add both
 * as Pulse kinds"; migration 20261013130000).
 *
 *   RELATIONSHIP_KINDS   the 17 kinds, as the database takes them
 *   CONFLICT_KINDS       the kinds whose pairs can catch a character in the middle
 */

const RELATIONSHIP_KINDS = Object.freeze([
  'collab', 'rival', 'couple', 'ex', 'baby_daddy', 'baby_mama', 'bestie', 'mentor',
  'copycat', 'shade', 'situationship', 'family', 'management', 'feud', 'secret_link',
  'orbit', 'former_friends',
]);

// The map's old conflict kinds (beef, public_shade, former_friends) as Pulse kinds.
const CONFLICT_KINDS = Object.freeze(['feud', 'shade', 'former_friends']);

module.exports = { RELATIONSHIP_KINDS, CONFLICT_KINDS };

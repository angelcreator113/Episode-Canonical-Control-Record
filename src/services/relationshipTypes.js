'use strict';

/**
 * The app's relationship types, and one way to read any type as one of
 * them (Evoni, 2026-10-24: "I want them all"; then "Yes tidy up existing
 * relationships"). Generate and the scene/Pulse inbox (services/
 * relationshipSeeds) and the type tidy-up (routes/relationships
 * /type-tidy) all read types here, so a type means the same everywhere.
 *
 *   APP_TYPES                     the page's list (frontend RelationshipEngine/tokens.js REL_PRESETS)
 *   normalizeType(raw, opts)      { type, is_romantic, flavour } or null when it cannot decide
 *   canonicalType(raw)            the list's spelling when raw is a list type ("Rival" → "rival"), else null
 *   isKnownType(raw)              exactly a list type, a family role familyTies reads, or 'family'
 *   familyRoleOf(type)            a family role that is not a partner's ("sister", "step-mother") or null
 *   words(v) / roleWords(v) / capital(v)
 *
 * flavour is the original words when they said more than the type does
 * ("Fidelity test" → love_interest, flavour "Fidelity test"), so a caller
 * can keep them in the situation.
 */

const familyTies = require('./familyTies');

const APP_TYPES = Object.freeze([
  'love_interest', 'sister', 'brother', 'mother', 'father', 'husband', 'wife',
  'best friend', 'friend', 'collaborator', 'rival', 'mentor', 'manager', 'stylist', 'fan',
]);
const ROMANTIC_TYPES = new Set(['love_interest', 'husband', 'wife']);

// Each story kind (relationshipTruth.storyCategory) as one of the page's types.
const CATEGORY_TYPE = {
  romance: 'love_interest', ex: 'love_interest', friend: 'friend', rival: 'rival', enemy: 'rival',
  mentor: 'mentor', manager: 'manager', collab: 'collaborator', fan: 'fan',
};
// The Pulse's kinds (social_profile_relationships.relationship_type).
const PULSE_TYPE = {
  couple: 'love_interest', situationship: 'love_interest', ex: 'love_interest', baby_daddy: 'love_interest', baby_mama: 'love_interest',
  bestie: 'best friend', orbit: 'fan', collab: 'collaborator', management: 'manager', mentor: 'mentor',
  rival: 'rival', feud: 'rival', shade: 'rival', copycat: 'rival', former_friends: 'rival', family: 'family',
};
// Words the older generator invented, read before the story kinds
// (relationshipTruth's patterns do not know them).
const INVENTED = [
  [/temptation|fidelity|affair|the one who (stayed|left|got away)|flirt|crush|forbidden/, 'love_interest'],
  [/best ?friend|bestie|\bbff\b/, 'best friend'],
  [/stylist/, 'stylist'],
  [/critic|hater|detractor|antagonist|competit|frenem|grudge|saboteur/, 'rival'],
  [/confidant|ally|supporter|sounding board|protector/, 'friend'],
  [/admirer|follower|superfan/, 'fan'],
];

const words = (v) => String(v || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
// A role as familyTies reads it: hyphens kept ("ex-wife", "great-aunt").
const roleWords = (v) => String(v || '').trim().toLowerCase().replace(/_+/g, ' ').replace(/\s+/g, ' ');
const capital = (v) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : v);

/** A family role that is not a partner's: "sister", "step-mother" … or null. */
function familyRoleOf(type) {
  const w = roleWords(type);
  if (!w || familyTies.isSpouseRole(w)) return null;
  return familyTies.reverseRole(w) !== null ? w : null;
}

/** The list's spelling of a list type, whatever its case or underscores; else null. */
function canonicalType(raw) {
  const w = words(raw);
  return w ? APP_TYPES.find((t) => words(t) === w) || null : null;
}

/** Exactly as the app writes it: a list type, a family role familyTies reads, or 'family'. */
function isKnownType(raw) {
  const t = String(raw || '');
  return APP_TYPES.includes(t) || t === 'family' || (familyRoleOf(t) !== null && t === roleWords(t));
}

/**
 * Any type as one of the page's: { type, is_romantic, flavour }, or null
 * when it cannot decide. A family role stays as it is ("cousin"). With
 * keepUnknown (Evoni's own picks: the scene banner, the Pulse) a type it
 * cannot place is kept as written.
 */
function normalizeType(raw, { romantic = false, keepUnknown = false } = {}) {
  const w = words(raw);
  if (!w) return romantic ? { type: 'love_interest', is_romantic: true, flavour: null } : null;
  const asApp = canonicalType(raw);
  if (asApp) return { type: asApp, is_romantic: romantic || ROMANTIC_TYPES.has(asApp), flavour: null };
  const role = familyRoleOf(raw);
  if (role) return { type: role, is_romantic: false, flavour: null };
  const flavour = capital(w);
  if (familyTies.isSpouseRole(roleWords(raw))) return { type: 'love_interest', is_romantic: true, flavour };
  const pulseType = PULSE_TYPE[w.replace(/ /g, '_')];
  if (pulseType) return { type: pulseType, is_romantic: pulseType === 'love_interest', flavour: null };
  const invented = INVENTED.find(([re]) => re.test(w));
  if (invented) return { type: invented[1], is_romantic: romantic || invented[1] === 'love_interest', flavour };
  const category = require('./relationshipTruth').storyCategory({ relationship_type: w, is_romantic: romantic });
  if (category && CATEGORY_TYPE[category]) {
    const type = CATEGORY_TYPE[category];
    return { type, is_romantic: romantic || type === 'love_interest', flavour };
  }
  if (category === 'family') return { type: 'family', is_romantic: false, flavour };
  if (keepUnknown) return { type: w.slice(0, 100), is_romantic: romantic, flavour: null };
  return null;
}

module.exports = { APP_TYPES, normalizeType, canonicalType, isKnownType, familyRoleOf, words, roleWords, capital };

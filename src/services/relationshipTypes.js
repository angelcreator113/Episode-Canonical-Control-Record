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
 *   isKnownType(raw)              exactly a list type, a company type, a family role familyTies reads, or 'family'
 *   familyRoleOf(type)            a family role that is not a partner's ("sister", "step-mother") or null
 *   words(v) / roleWords(v) / capital(v)
 *
 * A company's types (Evoni, 2026-10-24: "how should we handle relationships
 * between brands?"): a registry character marked as a company (services/
 * companyCharacters) is never in a romance or a family; its pairs take
 * these instead.
 *   COMPANY_TYPES / COMPANY_TYPE_LABELS   client_partner, sponsor, represents, press, rival_brand, fan
 *   BRAND_PAIR_TYPES                      two companies: client_partner or rival_brand only
 *   isCompanyType(raw)                    exactly one of them
 *   normalizeCompanyType(raw, { brandPair })  any type as a company type: { type, is_romantic: false, flavour } or null
 *   companyRefusal(type, isRomantic)      why a company pair cannot take it (romance, family), or null
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
// Whole words only where a short stem could sit inside another word
// ("kin" in "making", "ex" in "next").
const INVENTED = [
  [/temptation|fidelity|affair|the one who (stayed|left|got away)|flirt|crush|forbidden|lover|\bflame\b|romanc|\bex\b|situationship|\blove\b|sweetheart|soulmate|courtship|seduc/, 'love_interest'],
  [/best ?friend|bestie|\bbff\b|ride or die/, 'best friend'],
  [/stylist/, 'stylist'],
  [/\bkin\b|kinship|kinfolk|bloodline|\bblood\b|famil|sibling|\bcousins?\b|\brelatives?\b|lineage|\bheirs?\b|inherit|ancestr/, 'family'],
  [/critic|hater|detractor|antagonist|competit|frenem|grudge|saboteur|nemesis|enem|opponent|adversar|threat|feud|betray|usurp|copycat|imitat/, 'rival'],
  [/mentor|mentee|protege|protégé|teacher|tutor|guide|apprentic|elder|guru|coach/, 'mentor'],
  [/manag|\bagent\b|\bboss\b|employer|handler|publicist/, 'manager'],
  [/transaction|symbio|patron|client|commission|sponsor|business|\bdeal\b|contract|brand|collab|co-?creat|partnership|vendor|supplier|investor|alliance/, 'collaborator'],
  [/confidant|\ball(y|ies)\b|supporter|sounding board|protector|companion|kindred|comrade|buddy|\bpal\b|neighbo|classmate|roommate|friend/, 'friend'],
  [/admirer|follower|superfan|devotee|\bstans?\b|groupie/, 'fan'],
];

const COMPANY_TYPES = Object.freeze(['client_partner', 'sponsor', 'represents', 'press', 'rival_brand', 'fan']);
const COMPANY_TYPE_LABELS = Object.freeze({
  client_partner: 'Client or partner', sponsor: 'Sponsor', represents: 'Works for / represents',
  press: 'Press or critic', rival_brand: 'Rival brand', fan: 'Fan',
});
const BRAND_PAIR_TYPES = Object.freeze(['client_partner', 'rival_brand']);
// Words for a company pair, read before the page's own types are.
const COMPANY_WORDS = [
  [/sponsor|ambassador|endorse|backer|\bfunds?\b|underwrit/, 'sponsor'],
  [/represent|works? for|employ|staff|\brep\b|spokes|\bagent\b|manag|mentor|\bboss\b|director|founder|designer|publicist|\bface of\b|muse|model/, 'represents'],
  [/press|critic|journalist|editor|reporter|writer|columnist|coverage|review|interview|profiled|wrote about/, 'press'],
  [/rival|competit|enem|feud|nemesis|copycat|imitat|grudge|adversar|frenem/, 'rival_brand'],
  [/\bfan\b|admirer|follower|superfan|devotee|\bstans?\b|customer|shopper|loyal|wears? (it|them)/, 'fan'],
  [/client|partner|collab|deal|contract|campaign|commission|business|transaction|vendor|supplier|stylist|patron|investor|alliance|co-?brand|friend|ally/, 'client_partner'],
];
// The page's types, read for a company pair.
const COMPANY_FROM_APP = {
  collaborator: 'client_partner', stylist: 'client_partner', friend: 'client_partner', 'best friend': 'client_partner',
  rival: 'rival_brand', fan: 'fan', mentor: 'represents', manager: 'represents',
};

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
  return APP_TYPES.includes(t) || COMPANY_TYPES.includes(t) || t === 'family' || (familyRoleOf(t) !== null && t === roleWords(t));
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

/** Exactly one of the company types. */
function isCompanyType(raw) {
  return COMPANY_TYPES.includes(String(raw || ''));
}

/** Why a company pair cannot take this type, or null: never a romance, never family. */
function companyRefusal(type, isRomantic = false) {
  const w = roleWords(type);
  if (isRomantic === true || ROMANTIC_TYPES.has(words(type).replace(/ /g, '_')) || familyTies.isSpouseRole(w)) {
    return 'A company is never in a romance. Pick a company type (client or partner, sponsor, works for, press, rival brand, fan).';
  }
  if (w === 'family' || familyRoleOf(type)) {
    return 'A company has no family. Pick a company type (client or partner, sponsor, works for, press, rival brand, fan).';
  }
  return null;
}

/**
 * Any type as a company type, for a pair where either side is a company:
 * { type, is_romantic: false, flavour } or null (a romance or family role
 * has no company reading). Two companies (brandPair) are partners or rival
 * brands only.
 */
function normalizeCompanyType(raw, { brandPair = false } = {}) {
  const w = words(raw);
  if (!w) return null;
  const fit = (type) => (brandPair && !BRAND_PAIR_TYPES.includes(type) ? 'client_partner' : type);
  const exact = COMPANY_TYPES.find((t) => words(t) === w);
  if (exact) return { type: fit(exact), is_romantic: false, flavour: null };
  if (companyRefusal(raw)) return null;
  const asApp = canonicalType(raw);
  if (asApp && COMPANY_FROM_APP[asApp]) return { type: fit(COMPANY_FROM_APP[asApp]), is_romantic: false, flavour: null };
  const hit = COMPANY_WORDS.find(([re]) => re.test(w));
  if (hit) return { type: fit(hit[1]), is_romantic: false, flavour: capital(w) };
  return null;
}

module.exports = {
  COMPANY_TYPES, COMPANY_TYPE_LABELS, BRAND_PAIR_TYPES, isCompanyType, normalizeCompanyType, companyRefusal,
  APP_TYPES, normalizeType, canonicalType, isKnownType, familyRoleOf, words, roleWords, capital };

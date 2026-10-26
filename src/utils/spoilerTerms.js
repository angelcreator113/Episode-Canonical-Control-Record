'use strict';

/**
 * Whether a piece of My Little List wording names something Lala has not
 * learned yet (Evoni, 2026-10-26, ruling 2: "Apply spoiler safety to titles,
 * notes, progress counts, and all other displayed information"; ruling 5:
 * "Test for semantic spoilers ... Include cases where private information
 * is paraphrased").
 *
 * The private side is the names of what she has not learned at that line:
 * the event (its name, host, brand, venue) before the invitation, the
 * brand before the offer, each opportunity (its name, company, venue)
 * before she discovers it. Both sides are cut to content words, each word
 * reduced to its stem and to its concept, so "catwalk" meets "runway",
 * "proposal" meets "propose", "Maison Rue's" meets "Maison Rue". A match
 * means the wording leaks; the list hides that item and flags it for the
 * producer. Words common to any event ("event", "party", "the") are not
 * private on their own. Pure.
 */

const STOP = new Set([
  'a', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'get', 'got', 'her', 'his',
  'i', 'in', 'into', 'is', 'it', 'its', 'me', 'my', 'of', 'on', 'or', 'our', 'out', 'so', 'some',
  'that', 'the', 'their', 'them', 'then', 'this', 'to', 'up', 'us', 'was', 'we', 'with', 'you', 'your',
  // Words any event, deal or opportunity has: not private on their own.
  'event', 'events', 'party', 'night', 'day', 'opportunity', 'opportunities', 'invitation', 'invite',
  'deal', 'offer', 'session', 'sessions', 'special', 'big', 'new', 'first', 'annual', 'launch',
  'experience', 'presents', 'present', 'official', 'private', 'surprise', 'secret', 'studio', 'club',
  'house', 'brand', 'company', 'co', 'inc', 'ltd', 'llc', 'shoot', 'cover', 'show', 'gala',
]);

// One concept per group: a paraphrase lands on the same word.
const CONCEPTS = [
  // Only words that point at one thing: "walk", "ring", "sign", "win" and
  // "split" are everyday words and would hide harmless wording.
  ['runway', 'catwalk', 'model', 'modeling', 'modelling'],
  ['propose', 'proposal', 'proposing', 'engaged', 'engagement'],
  ['wedding', 'marry', 'married', 'marriage', 'bride', 'groom'],
  ['pregnant', 'pregnancy', 'expecting'],
  ['fired', 'sacked', 'dismissed', 'terminated'],
  ['award', 'awards', 'trophy', 'prize', 'winner', 'nominated', 'nomination'],
  ['magazine', 'editorial', 'covershoot'],
  ['contract', 'signing'],
  ['breakup', 'dumped', 'divorce'],
  ['affair', 'cheating', 'cheated'],
];
const CONCEPT_OF = new Map(CONCEPTS.flatMap((group) => group.map((w) => [w, group[0]])));

/** A word's stem: plural, -ing, -ed and possessive endings off. */
function stem(word) {
  let w = word.replace(/'s$/, '').replace(/s'$/, 's');
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith('es')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  return w;
}

/** The content words of a text, as concepts or stems. */
function terms(text) {
  const out = new Set();
  const words = String(text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .match(/[a-z0-9']+/g) || [];
  for (const raw of words) {
    const w = raw.replace(/^'+|'+$/g, '');
    if (w.length < 3 || STOP.has(w)) continue;
    const concept = CONCEPT_OF.get(w) || CONCEPT_OF.get(stem(w));
    if (concept) { out.add(concept); continue; }
    const s = stem(w);
    if (s.length >= 3 && !STOP.has(s)) out.add(s);
  }
  return out;
}

/** The private terms of the names given. */
function privateTerms(names = []) {
  const out = new Set();
  for (const n of names) for (const t of terms(n)) out.add(t);
  return out;
}

/** The private terms a text names, if any. */
function leaks(text, privateSet) {
  if (!privateSet || !privateSet.size) return [];
  return [...terms(text)].filter((t) => privateSet.has(t));
}

module.exports = { terms, privateTerms, leaks, stem, CONCEPTS };

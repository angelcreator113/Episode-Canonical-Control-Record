'use strict';

/**
 * Heritage tags (Evoni, 2026-10-24: "how can we be sure race makes sense in
 * the family trees?"; "I want them all").
 *
 * registry_characters.heritage_tags is a short list of words for a person's
 * heritage, the way they would describe themselves ("Black", "Korean"). It
 * sits beside ethnicity, which stays Evoni's own free-text wording. The tags
 * are only there so the family views can line relatives up and notice when
 * blood family shares nothing: real families include mixed heritage,
 * adoption, step and chosen family, so this helps Evoni notice. It never
 * enforces sameness, never blocks a save and never changes anyone's heritage
 * on its own.
 *
 * A tag is stored as typed (trimmed, spaces collapsed); its matching key is
 * the same words lowercased, so "korean" and "Korean" are one tag.
 *
 *   STARTER_TAGS            the small fixed list offered first (anyone can add their own)
 *   heritageKey(tag)        the matching key
 *   normalizeTags(value)    a clean list from a body (array or comma text), deduped by key
 *   sharedKeys(a, b)        the keys two lists have in common
 *   tagsFromEthnicity(text) the starter tags the text names exactly, or [] (never a guess)
 */

const STARTER_TAGS = Object.freeze([
  'Black', 'African American', 'Afro-Caribbean', 'African',
  'White', 'Irish', 'Italian', 'Jewish',
  'Latine', 'Mexican', 'Puerto Rican', 'Dominican',
  'East Asian', 'Korean', 'Chinese', 'Japanese', 'Filipino', 'Vietnamese',
  'South Asian', 'Indian', 'Middle Eastern', 'Arab',
  'Indigenous', 'Pacific Islander',
]);

const MAX_TAGS = 12;
const MAX_TAG = 60;

const heritageKey = (tag) => String(tag ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
const STARTER_BY_KEY = new Map(STARTER_TAGS.map((t) => [heritageKey(t), t]));

/** A clean list: trimmed, spaces collapsed, no empties, one per key (the first spelling kept). */
function normalizeTags(value) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const tag = item.trim().replace(/\s+/g, ' ').slice(0, MAX_TAG);
    const key = heritageKey(tag);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    // A starter tag keeps the list's spelling, so one heritage reads one way.
    out.push(STARTER_BY_KEY.get(key) || tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

/** The tags as a list whatever was stored (null, JSON text, an array). */
function tagsOf(value) {
  if (Array.isArray(value)) return normalizeTags(value);
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    try { return normalizeTags(JSON.parse(value)); } catch (err) {
      console.error('[heritageTags] stored tags are not JSON:', err.message);
    }
  }
  return [];
}

function sharedKeys(a, b) {
  const right = new Set(tagsOf(b).map(heritageKey));
  return tagsOf(a).map(heritageKey).filter((k) => right.has(k));
}

/**
 * The starter tags an ethnicity text names exactly: the whole text is one
 * starter tag ("Black", "korean"), or a list of them ("Black and Korean",
 * "Black / Korean", "Black, Korean"), every part an exact match. Anything
 * else ("Mixed-race", "Korean-ish", "Black American from Ohio") gives []:
 * those are left for Evoni.
 */
function tagsFromEthnicity(text) {
  const words = String(text ?? '').trim().replace(/[.!]+$/, '');
  if (!words) return [];
  const parts = words.split(/\s*(?:,|\/|&|\+|\band\b)\s*/i).map(heritageKey).filter(Boolean);
  if (!parts.length) return [];
  const hits = parts.map((p) => STARTER_BY_KEY.get(p));
  if (hits.some((h) => !h)) return [];
  return normalizeTags(hits);
}

module.exports = { STARTER_TAGS, MAX_TAGS, heritageKey, normalizeTags, tagsOf, sharedKeys, tagsFromEthnicity };

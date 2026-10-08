/**
 * The cast (the Characters page, to Evoni's mock, 2026-10-08): Lala, the
 * people in her world, and the characters left from the old system. Pure;
 * CharacterRegistryPage renders.
 *
 * A feed person is a LalaVerse feed profile; its character is the registry
 * entry that names it (registry_characters.feed_profile_id, ruling C3),
 * which the profiles list returns as registry_character_id. An old-system
 * character is a registry character no feed profile is linked to, Lala
 * aside.
 */

const norm = (s) => String(s || '').trim().toLowerCase();

/** Lala in these characters: her key, else her name. */
export function findLala(characters) {
  const list = characters || [];
  return list.find((c) => norm(c.character_key) === 'lala') || list.find((c) => norm(c.display_name) === 'lala') || null;
}

/** The LalaVerse feed profiles (not the real-world ones Lala follows), each with its character if linked. */
export function feedPeople(profiles, characters) {
  const byId = new Map((characters || []).map((c) => [String(c.id), c]));
  return (profiles || [])
    .filter((p) => p && p.feed_layer === 'lalaverse')
    .map((p) => ({
      id: p.id,
      name: p.display_name || p.handle || 'Unnamed profile',
      handle: p.handle || null,
      archetype: archetypeLabel(p),
      characterId: p.registry_character_id || null,
      character: p.registry_character_id ? byId.get(String(p.registry_character_id)) || null : null,
    }));
}

/** A profile's archetype as words: the Society tab's, else the feed's. */
export function archetypeLabel(p) {
  const raw = p?.society_archetype || p?.archetype;
  if (!raw) return null;
  const words = String(raw).replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Registry characters no feed profile is linked to, Lala aside, by name. */
export function oldSystem(characters, profiles, lala) {
  // Only LalaVerse profiles count: a character is in Lala's world when one names it.
  const linked = new Set((profiles || []).filter((p) => p?.feed_layer === 'lalaverse').map((p) => p.registry_character_id).filter(Boolean).map(String));
  return (characters || [])
    .filter((c) => c && !linked.has(String(c.id)) && c.id !== lala?.id)
    .sort((a, b) => String(a.display_name || '').localeCompare(String(b.display_name || '')));
}

/** "Jade (Business Coach)" and "Jade" are both Jade. */
export const baseName = (name) => norm(String(name || '').replace(/\s*\([^)]*\)\s*$/, ''));

/** For each character sharing its base name with another: how many share it. */
export function sameNames(characters) {
  const counts = new Map();
  for (const c of characters || []) {
    const k = baseName(c.display_name);
    if (k) counts.set(k, (counts.get(k) || 0) + 1);
  }
  const out = {};
  for (const c of characters || []) {
    const n = counts.get(baseName(c.display_name)) || 0;
    if (n > 1) out[c.id] = n;
  }
  return out;
}

const NUMBER_WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
/** 'Two "Jade"s' */
export function sameNameNote(n, name) {
  const first = String(name || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  return `${NUMBER_WORDS[n] || n} "${first}"s`;
}

/**
 * Which registry the page works in (audit IA-05, 2026-10-03): the one the
 * URL names (?registry=), else the active show's, else the only one; null
 * is "all registries", a read-only view. Quick create never falls back to
 * the first registry the API returned.
 */
export function chooseRegistry(registries, { urlRegistryId = null, showId = null } = {}) {
  if (!registries?.length) return null;
  const byUrl = urlRegistryId && registries.find((r) => String(r.id) === String(urlRegistryId));
  if (byUrl) return byUrl.id;
  const byShow = showId && registries.find((r) => String(r.show_id || '') === String(showId));
  if (byShow) return byShow.id;
  return registries.length === 1 ? registries[0].id : null;
}

/**
 * The cast's two numbers, as the Characters page shows them (the LalaVerse
 * Overview's Characters tile, Evoni 2026-10-08: "Match The cast"): the
 * people in Lala's world, and the old-system characters still to review in
 * the registry the page would open on (kept ones aside, when the review
 * is known). `toReview` is null when no registry would be chosen.
 */
export function castCounts({ registries, profiles, showId, review }) {
  const all = (registries || []).flatMap((r) => (r.characters || []).map((c) => ({ ...c, registry_id: r.id })));
  const registryId = chooseRegistry(registries, { showId });
  const people = feedPeople(profiles, all).length;
  if (!registryId) return { people, toReview: null, registryId: null };
  const characters = all.filter((c) => c.registry_id === registryId);
  const old = oldSystem(characters, profiles, findLala(characters));
  const kept = (c) => review?.byId?.[c.id]?.cast_review === 'kept';
  return { people, toReview: old.filter((c) => !kept(c)).length, registryId };
}

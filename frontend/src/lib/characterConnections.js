/**
 * The Connections tab (Evoni's mock, 2026-10-18, step 4 of the character
 * page). Pure: pages/CharacterProfilePage renders.
 *
 * A relationship (GET /api/v1/relationships/character/:id) has a free-text
 * relationship_type, an optional role_tag (ally, detractor, mentor,
 * dependency, rival, partner, family…), family_role, is_romantic and a
 * tension_state (calm, healing, simmering, volatile, fractured). This puts
 * each in one group for the filters, says how close it is, and sorts.
 */

export const GROUPS = [
  { key: 'friend', label: 'Friends' },
  { key: 'working', label: 'Working' },
  { key: 'rival', label: 'Rivals' },
  { key: 'family', label: 'Family' },
  { key: 'romantic', label: 'Romantic' },
  { key: 'other', label: 'Other' },
];

const has = (text, re) => re.test(String(text || '').toLowerCase());

/** One group per relationship: family, romantic, rival, working, friend, else other. */
export function groupOf(r) {
  const type = r?.relationship_type;
  const tag = String(r?.role_tag || '').toLowerCase();
  if (r?.family_role || r?.is_blood_relation || tag === 'family' || has(type, /family|mother|father|sister|brother|aunt|uncle|cousin|daughter|son\b|parent|grand/)) return 'family';
  if (r?.is_romantic || has(type, /romant|lover|dating|girlfriend|boyfriend|spouse|wife|husband|\bex\b|crush/)) return 'romantic';
  if (tag === 'rival' || tag === 'detractor' || has(type, /rival|enem|detract|competit|nemesis/)) return 'rival';
  if (['mentor', 'partner', 'dependency'].includes(tag) || has(type, /business|work|collab|colleague|client|mentor|brand|manager|agent|boss|employ|partner|stylist|assistant|crew/)) return 'working';
  if (tag === 'ally' || has(type, /friend|bestie|ally|confidant/)) return 'friend';
  return 'other';
}

// How close, from the tension state (the Overview's tie meter uses the same scale).
export const TENSION = {
  calm: { score: 90, label: 'Close' },
  healing: { score: 70, label: 'Healing' },
  simmering: { score: 45, label: 'Simmering' },
  volatile: { score: 25, label: 'Volatile' },
  fractured: { score: 10, label: 'Fractured' },
};
export const closenessOf = (r) => TENSION[r?.tension_state]?.score ?? null;
export const isClose = (r) => (closenessOf(r) ?? 0) >= 60;

export const nameOf = (r) => r?.related_name || r?.character_b_name || r?.character_a_name || 'Someone';
const words = (s) => {
  const t = String(s || '').replace(/_/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : null;
};
export const typeLabel = (r) => words(r?.relationship_type) || words(r?.role_tag) || words(r?.family_role) || 'Connected';
export const noteOf = (r) => [r?.situation, r?.notes, r?.conflict_summary].find((x) => typeof x === 'string' && x.trim())?.trim() || null;

/** Counts for the tiles and the filters. */
export function connectionStats(list) {
  const rows = Array.isArray(list) ? list : [];
  const groups = Object.fromEntries(GROUPS.map((g) => [g.key, 0]));
  for (const r of rows) groups[groupOf(r)] += 1;
  return { total: rows.length, close: rows.filter(isClose).length, groups };
}

export const SORTS = [
  { key: 'closeness', label: 'Closest first' },
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Connection type' },
  { key: 'newest', label: 'Newest' },
];

const time = (r) => {
  const t = new Date(r?.created_at).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/** The list as the filter, search and sort say. filter: all | close | a group key. */
export function filterConnections(list, { filter = 'all', query = '', sort = 'closeness' } = {}) {
  const q = query.trim().toLowerCase();
  const rows = (Array.isArray(list) ? list : []).filter((r) => {
    if (filter === 'close' && !isClose(r)) return false;
    if (filter !== 'all' && filter !== 'close' && groupOf(r) !== filter) return false;
    if (!q) return true;
    return [nameOf(r), typeLabel(r), noteOf(r)].some((x) => x && x.toLowerCase().includes(q));
  });
  const by = {
    closeness: (a, b) => (closenessOf(b) ?? -1) - (closenessOf(a) ?? -1) || nameOf(a).localeCompare(nameOf(b)),
    name: (a, b) => nameOf(a).localeCompare(nameOf(b)),
    type: (a, b) => typeLabel(a).localeCompare(typeLabel(b)) || nameOf(a).localeCompare(nameOf(b)),
    newest: (a, b) => time(b) - time(a),
  };
  return [...rows].sort(by[sort] || by.closeness);
}

/** Their key relationships: Lala first, then the closest, then the rest with something written. */
export function keyRelationships(list, n = 3) {
  const rows = Array.isArray(list) ? list : [];
  const lala = (r) => /^lala\b/i.test(nameOf(r));
  return [...rows].sort((a, b) => (lala(b) - lala(a))
    || ((closenessOf(b) ?? -1) - (closenessOf(a) ?? -1))
    || (Boolean(noteOf(b)) - Boolean(noteOf(a)))).slice(0, n);
}

/** When each connection began, newest first: the ones with a date. */
export function connectionHistory(list) {
  return (Array.isArray(list) ? list : []).filter((r) => time(r) > 0).sort((a, b) => time(b) - time(a));
}

/**
 * Where each person sits on the map: up to `n` around the centre, evenly
 * spaced from the top, in a box of `size`.
 */
export function mapPoints(list, n = 6, size = 300) {
  const rows = keyRelationships(list, n);
  const c = size / 2;
  const radius = size * 0.36;
  return rows.map((r, i) => {
    const a = (-Math.PI / 2) + (2 * Math.PI * i) / rows.length;
    return { r, x: Math.round(c + radius * Math.cos(a)), y: Math.round(c + radius * Math.sin(a)) };
  });
}

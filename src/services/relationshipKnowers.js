'use strict';

/**
 * Who knows about a relationship (Evoni, 2026-10-23: "each relationship
 * records who knows the truth of it, like character secrets do, so the
 * writers know who can mention it and who can't").
 *
 * On character_relationships (migration 20261024100000):
 *
 *   known_by      who knows, besides the two of them; each entry is one of
 *                 { registry_character_id } a character
 *                 { profile_id }            a Feed profile with no character
 *                 { name }                  anyone else, by name
 *                 with since_episode_id? (the episode they learned it in) and how?
 *   public_state  where everyone else stands:
 *                 secret    nobody else knows
 *                 rumoured  people have heard talk; nobody has confirmed it
 *                 known     out in the open
 *
 * The old "knows" notes (source_knows, target_knows, reader_knows) stay as
 * they are: they say what each person knows about the other.
 *
 *   knowersPatch(sequelize, relId, body)       the SET parts PUT /relationships/:id adds
 *                                              for known_by / public_state; a KnowerError when wrong
 *   whoKnows(sequelize, relationshipIds)       Map id -> { public_state, kind, pair, knowers }, for writers;
 *                                              an empty Map before the migration has run
 *   addKnower(sequelize, relId, who, opts)     add one person (the "What changed" card's "Jade now knows")
 *   relationshipSecrecyLines(sequelize, ids)   one line per relationship around these characters
 *   secrecyLine(entry)                         the line for one whoKnows entry
 *   secretsKnownBy(sequelize, characterId)     the secret and rumoured relationships a character
 *                                              knows of, as private Pulse knowledge
 *
 * Raw SQL; the route and the writers call it.
 */

const STATES = ['secret', 'rumoured', 'known'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_KNOWERS = 40;
const MAX_LINES = 12;
const nameSql = (alias) => `COALESCE(NULLIF(${alias}.selected_name, ''), ${alias}.display_name)`;

class KnowerError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; this.name = 'KnowerError'; }
}

const keyOf = (k) => (k.registry_character_id ? `c:${k.registry_character_id}`
  : k.profile_id != null ? `p:${k.profile_id}` : `n:${String(k.name || '').trim().toLowerCase()}`);

/** One entry from what a request or a caller sends: a character id, a profile id, a name, or an object. */
function entryOf(who) {
  if (who == null) throw new KnowerError('Say who knows.');
  if (typeof who === 'string') {
    const t = who.trim();
    if (!t) throw new KnowerError('Say who knows.');
    return UUID_RE.test(t) ? { registry_character_id: t } : { name: t };
  }
  if (typeof who === 'number') return { profile_id: who };
  if (typeof who !== 'object' || Array.isArray(who)) throw new KnowerError('Each person who knows is a character, a Feed profile or a name.');
  const out = {};
  const ids = ['registry_character_id', 'profile_id', 'name'].filter((k) => who[k] != null && who[k] !== '');
  if (ids.length !== 1) throw new KnowerError('Each person who knows is one of: a character, a Feed profile, or a name.');
  if (who.registry_character_id != null) {
    if (!UUID_RE.test(String(who.registry_character_id))) throw new KnowerError('A character who knows is given by their id.');
    out.registry_character_id = String(who.registry_character_id);
  } else if (who.profile_id != null) {
    const n = Number(who.profile_id);
    if (!Number.isInteger(n) || n <= 0) throw new KnowerError('A Feed profile who knows is given by its id.');
    out.profile_id = n;
  } else {
    const t = typeof who.name === 'string' ? who.name.trim() : '';
    if (!t) throw new KnowerError('Say who knows.');
    out.name = t.slice(0, 120);
  }
  if (who.since_episode_id != null && who.since_episode_id !== '') {
    if (!UUID_RE.test(String(who.since_episode_id))) throw new KnowerError('since_episode_id must be an episode id.');
    out.since_episode_id = String(who.since_episode_id);
  }
  if (typeof who.how === 'string' && who.how.trim()) out.how = who.how.trim().slice(0, 300);
  return out;
}

/** The list checked: one entry each, the two of them left out, every character and profile real. */
async function normalizeKnowers(sequelize, list, pair) {
  if (!Array.isArray(list)) throw new KnowerError('known_by is a list of who knows.');
  if (list.length > MAX_KNOWERS) throw new KnowerError(`At most ${MAX_KNOWERS} people can be listed as knowing.`);
  const seen = new Map();
  for (const raw of list) {
    const e = entryOf(raw);
    if (e.registry_character_id && pair.includes(e.registry_character_id)) continue;
    if (!seen.has(keyOf(e))) seen.set(keyOf(e), e);
  }
  const entries = [...seen.values()];
  const chars = entries.filter((e) => e.registry_character_id).map((e) => e.registry_character_id);
  if (chars.length) {
    const [found] = await sequelize.query('SELECT id FROM registry_characters WHERE id IN (:chars) AND deleted_at IS NULL', { replacements: { chars } });
    if (found.length !== chars.length) throw new KnowerError('Someone listed as knowing is not a character.');
  }
  const profiles = entries.filter((e) => e.profile_id != null).map((e) => e.profile_id);
  if (profiles.length) {
    const [found] = await sequelize.query('SELECT id FROM social_profiles WHERE id IN (:profiles) AND deleted_at IS NULL', { replacements: { profiles } });
    if (found.length !== profiles.length) throw new KnowerError('Someone listed as knowing is not a Feed profile.');
  }
  const episodes = [...new Set(entries.filter((e) => e.since_episode_id).map((e) => e.since_episode_id))];
  if (episodes.length) {
    const [found] = await sequelize.query('SELECT id FROM episodes WHERE id IN (:episodes) AND deleted_at IS NULL', { replacements: { episodes } });
    if (found.length !== episodes.length) throw new KnowerError('A "since" episode is not an episode.');
  }
  return entries;
}

async function pairOf(sequelize, relId) {
  const [[row]] = await sequelize.query(
    'SELECT id, character_id_a, character_id_b, known_by FROM character_relationships WHERE id = :relId AND deleted_at IS NULL',
    { replacements: { relId } });
  if (!row) throw new KnowerError('Relationship not found', 404);
  return row;
}

/**
 * What PUT /relationships/:id adds for known_by and public_state: { sets,
 * replacements } (empty when neither is sent). A KnowerError when wrong.
 */
async function knowersPatch(sequelize, relId, body = {}) {
  const sets = [];
  const replacements = {};
  if (body.public_state !== undefined) {
    if (!STATES.includes(body.public_state)) throw new KnowerError('Everyone else stands at secret, rumoured or known.');
    sets.push('public_state = :public_state');
    replacements.public_state = body.public_state;
  }
  if (body.known_by !== undefined) {
    const rel = await pairOf(sequelize, relId);
    const list = await normalizeKnowers(sequelize, body.known_by === null ? [] : body.known_by, [String(rel.character_id_a), String(rel.character_id_b)]);
    sets.push('known_by = CAST(:known_by AS jsonb)');
    replacements.known_by = JSON.stringify(list);
  }
  return { sets, replacements };
}

/**
 * Each relationship's knowers, resolved to names, by id:
 *   { id, public_state, kind, romantic, pair: [{ id, name }, { id, name }],
 *     knowers: [{ ...entry, name, since_episode_number }] }
 * An empty Map with no ids, or before the migration has run.
 */
async function whoKnows(sequelize, relationshipIds) {
  const ids = [...new Set((relationshipIds || []).filter((id) => UUID_RE.test(String(id || ''))))];
  const out = new Map();
  if (!ids.length) return out;
  let rows;
  try {
    [rows] = await sequelize.query(
      `SELECT cr.id, cr.known_by, cr.public_state, cr.is_romantic, cr.relationship_type, cr.family_role,
              cr.character_id_a, cr.character_id_b, ${nameSql('ca')} AS name_a, ${nameSql('cb')} AS name_b
         FROM character_relationships cr
         JOIN registry_characters ca ON ca.id = cr.character_id_a AND ca.deleted_at IS NULL
         JOIN registry_characters cb ON cb.id = cr.character_id_b AND cb.deleted_at IS NULL
        WHERE cr.id IN (:ids) AND cr.deleted_at IS NULL`, { replacements: { ids } });
  } catch (err) {
    // Before the migration has run the columns are not there: the writers go without.
    console.error('[relationshipKnowers] could not read who knows:', err.message);
    return out;
  }
  const lists = rows.map((r) => (Array.isArray(r.known_by) ? r.known_by : []));
  const all = lists.flat();
  const chars = [...new Set(all.filter((k) => k.registry_character_id).map((k) => k.registry_character_id))];
  const profiles = [...new Set(all.filter((k) => k.profile_id != null).map((k) => Number(k.profile_id)))];
  const episodes = [...new Set(all.filter((k) => k.since_episode_id).map((k) => k.since_episode_id))];
  const charName = new Map();
  const profileName = new Map();
  const episodeNumber = new Map();
  if (chars.length) {
    const [found] = await sequelize.query(
      `SELECT k.id, ${nameSql('k')} AS name FROM registry_characters k WHERE k.id IN (:chars) AND k.deleted_at IS NULL`, { replacements: { chars } });
    found.forEach((f) => charName.set(String(f.id), f.name));
  }
  if (profiles.length) {
    // A profile's character's name when one is linked (registry_characters.feed_profile_id), else the profile's.
    const [found] = await sequelize.query(
      `SELECT sp.id, COALESCE((SELECT ${nameSql('k')} FROM registry_characters k WHERE k.feed_profile_id = sp.id AND k.deleted_at IS NULL
                                ORDER BY k.updated_at DESC LIMIT 1), sp.display_name, sp.handle) AS name
         FROM social_profiles sp WHERE sp.id IN (:profiles) AND sp.deleted_at IS NULL`, { replacements: { profiles } });
    found.forEach((f) => profileName.set(Number(f.id), f.name));
  }
  if (episodes.length) {
    const [found] = await sequelize.query('SELECT id, episode_number FROM episodes WHERE id IN (:episodes) AND deleted_at IS NULL', { replacements: { episodes } });
    found.forEach((f) => episodeNumber.set(String(f.id), f.episode_number == null ? null : Number(f.episode_number)));
  }
  rows.forEach((r, i) => {
    const knowers = lists[i].map((k) => {
      const name = k.registry_character_id ? charName.get(String(k.registry_character_id))
        : k.profile_id != null ? profileName.get(Number(k.profile_id)) : k.name;
      return name ? { ...k, name, since_episode_number: k.since_episode_id ? episodeNumber.get(String(k.since_episode_id)) ?? null : null } : null;
    }).filter(Boolean);
    out.set(String(r.id), {
      id: String(r.id),
      public_state: STATES.includes(r.public_state) ? r.public_state : 'known',
      romantic: !!r.is_romantic,
      kind: r.is_romantic ? 'romance' : `relationship${r.relationship_type ? ` (${String(r.relationship_type).replace(/_/g, ' ')})` : ''}`,
      pair: [{ id: String(r.character_id_a), name: r.name_a }, { id: String(r.character_id_b), name: r.name_b }],
      knowers,
    });
  });
  return out;
}

/**
 * Add one person to a relationship's knowers: a character id, a Feed
 * profile id, a name or an entry object, with { episodeId, how }. Someone
 * already listed (or one of the two of them) is left as they are.
 * Returns { added, known_by }.
 */
async function addKnower(sequelize, relationshipId, who, { episodeId = null, how = null } = {}) {
  if (!UUID_RE.test(String(relationshipId || ''))) throw new KnowerError('Relationship not found', 404);
  const rel = await pairOf(sequelize, relationshipId);
  const current = Array.isArray(rel.known_by) ? rel.known_by : [];
  const base = typeof who === 'object' && who !== null ? { ...who } : entryOf(who);
  if (episodeId && base.since_episode_id == null) base.since_episode_id = episodeId;
  if (how && base.how == null) base.how = how;
  const pair = [String(rel.character_id_a), String(rel.character_id_b)];
  const [entry] = await normalizeKnowers(sequelize, [base], pair);
  if (!entry || current.some((k) => keyOf(k) === keyOf(entry))) return { added: false, known_by: current };
  const next = [...current, entry];
  await sequelize.query(
    'UPDATE character_relationships SET known_by = CAST(:known AS jsonb), updated_at = NOW() WHERE id = :id',
    { replacements: { id: rel.id, known: JSON.stringify(next) } });
  return { added: true, known_by: next };
}

const listOf = (names) => (names.length <= 1 ? names.join('')
  : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/** The line a writer reads for one whoKnows entry. */
function secrecyLine(entry) {
  const [a, b] = entry.pair.map((p) => p.name || 'someone');
  const what = `${a} and ${b}'s ${entry.kind}`;
  const names = entry.knowers.map((k) => k.name);
  const verb = names.length === 1 ? 'knows' : 'know';
  if (entry.public_state === 'secret') {
    return `${what} is SECRET: ${names.length ? `only ${listOf(names)} ${verb}` : 'only the two of them know'}. Nobody else mentions it.`;
  }
  if (entry.public_state === 'rumoured') {
    return `${what} is RUMOURED: ${names.length ? `${listOf(names)} ${verb} for sure; ` : ''}everyone else has only heard talk, so they may hint at it or ask, never state it as fact.`;
  }
  return `${what} is KNOWN: anyone may mention it.`;
}

/**
 * One line per live, confirmed relationship involving these characters (one
 * of the two, or listed as knowing), secrets first, then rumours, then the known ones, at most MAX_LINES.
 * [] with none, or before the migration has run.
 */
async function relationshipSecrecyLines(sequelize, characterIds, { max = MAX_LINES } = {}) {
  const ids = [...new Set((characterIds || []).filter((id) => UUID_RE.test(String(id || ''))).map(String))];
  if (!ids.length) return [];
  let rows;
  try {
    [rows] = await sequelize.query(
      `SELECT cr.id FROM character_relationships cr
        WHERE cr.deleted_at IS NULL AND cr.confirmed = true
          AND (cr.character_id_a IN (:ids) OR cr.character_id_b IN (:ids)
               OR EXISTS (SELECT 1 FROM jsonb_array_elements(cr.known_by) k WHERE k->>'registry_character_id' IN (:ids)))
        ORDER BY cr.created_at ASC`, { replacements: { ids } });
  } catch (err) {
    console.error('[relationshipKnowers] could not read the relationships:', err.message);
    return [];
  }
  const map = await whoKnows(sequelize, rows.map((r) => r.id));
  const rank = { secret: 0, rumoured: 1, known: 2 };
  return [...map.values()]
    .sort((x, y) => rank[x.public_state] - rank[y.public_state])
    .slice(0, max)
    .map(secrecyLine);
}

/**
 * The secret and rumoured relationships a character knows of (one of the
 * two, or listed by character or by their Feed profile), as
 * [{ person, knows }] for the Pulse drafter's private knowledge: knowing it
 * never lets them post it.
 */
async function secretsKnownBy(sequelize, characterId, { max = 4 } = {}) {
  if (!UUID_RE.test(String(characterId || ''))) return [];
  let rows;
  try {
    [rows] = await sequelize.query(
      `SELECT cr.id FROM character_relationships cr
         JOIN registry_characters me ON me.id = :id
        WHERE cr.deleted_at IS NULL AND cr.confirmed = true AND cr.public_state IN ('secret', 'rumoured')
          AND (cr.character_id_a = :id OR cr.character_id_b = :id
               OR cr.known_by @> jsonb_build_array(jsonb_build_object('registry_character_id', CAST(:id AS text)))
               OR (me.feed_profile_id IS NOT NULL AND cr.known_by @> jsonb_build_array(jsonb_build_object('profile_id', me.feed_profile_id))))
        ORDER BY cr.public_state = 'rumoured', cr.created_at ASC
        LIMIT :max`, { replacements: { id: characterId, max } });
  } catch (err) {
    console.error('[relationshipKnowers] could not read the secrets they know:', err.message);
    return [];
  }
  const map = await whoKnows(sequelize, rows.map((r) => r.id));
  return rows.map((r) => map.get(String(r.id))).filter(Boolean).map((e) => ({
    person: e.pair.map((p) => p.name).join(' and '),
    knows: e.public_state === 'secret'
      ? `Their ${e.kind} is a secret: never post, reveal or hint at it.`
      : `Their ${e.kind} is only a rumour: never confirm it.`,
  }));
}

module.exports = {
  STATES, KnowerError, entryOf, normalizeKnowers, knowersPatch, whoKnows, addKnower,
  secrecyLine, relationshipSecrecyLines, secretsKnownBy,
};

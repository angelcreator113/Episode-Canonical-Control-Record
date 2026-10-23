'use strict';

/**
 * One truth for relationships (Evoni, 2026-10-23: "We need to make sure
 * everywhere relationships are mentioned all information is the same").
 *
 * The story pair is the truth: character_relationships (two registry
 * characters), its current stage the newest relationship_events row that
 * names one. Everything else is read from it or checked against it:
 *
 *   - The Pulse pair (social_profile_relationships, two Pulse profiles) is
 *     linked to its story pair by character_relationship_id when both people
 *     have a profile (registry_characters.feed_profile_id). The online kind
 *     can differ on purpose (a secret romance shown as friends), so its
 *     public status is never changed here, and a difference is reported,
 *     not overwritten.
 *   - social_profiles.lala_relationship is Lala's tie to a profile; where a
 *     Lala-and-them story pair exists, that pair decides it.
 *   - registry_characters.relationships_map is computed from the story pairs
 *     where it is read; only its prose keys (dynamic_notes) are its own.
 *
 *   storyCategory(row)                 a story pair's kind as one word (romance, family, rival …) or null
 *   pulseKindFor(row)                  { category, kind, fits } on The Pulse, or null
 *   linkStoryAndPulse(sequelize)       backfill: link each unlinked Pulse pair to its story pair; idempotent
 *   syncStoryPair(sequelize, id)       after a story pair is saved: find or make its Pulse pair
 *   driftReport(sequelize)             where the stores disagree, each with a suggested fix
 *   applyDriftFix(sequelize, key)      apply one item's suggested fix
 *   keepDifferent(sequelize, key, …)   mark one item "different on purpose"
 *   lalaStoryTies(sequelize, ids)      Map(character id → Lala's story tie to them)
 *   tieWords(tie)                      a lala_relationship value in words ("knows Lala in person")
 *   storyRelationshipsMap(sequelize, characterId) / withStoryMap(stored, computed)
 *
 * Raw SQL only, so the migration that backfills the link can run it.
 */

const sq = (db) => db?.sequelize || db;
const rowsOf = async (db, sql, replacements = {}, transaction) => (await sq(db).query(sql, { replacements, transaction }))[0];

// ── What a story pair is ─────────────────────────────────────────────────
// Its newest stage wins over its kind: a "friend" pair whose last event made
// them lovers is a romance now.
const STAGE_CATEGORY = {
  lovers: 'romance', partners: 'romance', exes: 'ex', enemies: 'enemy',
  friends: 'friend', close_friends: 'friend', acquaintances: 'acquaintance', strangers: null,
};

const TYPE_PATTERNS = [
  ['ex', /\bex\b|ex-|former (partner|lover|husband|wife|boyfriend|girlfriend)|divorc/i],
  ['enemy', /former friend|enemy|nemesis|feud|beef|\bfoe\b/i],
  ['collab', /business partner|creative partner|professional/i],
  ['romance', /husband|wife|spouse|partner|boyfriend|girlfriend|lover|love|fianc|dating|romance|romantic|crush|affair|situationship/i],
  ['family', /sister|brother|mother|father|\bmom\b|\bdad\b|aunt|uncle|cousin|grand(ma|pa|mother|father|child|son|daughter)|daughter|\bson\b|niece|nephew|\bstep|sibling|family|twin/i],
  ['rival', /rival|competitor|competition/i],
  ['mentor', /mentor|mentee|prot[eé]g[eé]|apprentice|teacher/i],
  ['manager', /manag|\bagent\b|publicist|\bboss\b/i],
  ['collab', /collab|co-?worker|colleague|stylist|assistant|producer|client/i],
  ['friend', /friend|bestie|bff|confidant|\bally\b/i],
  ['fan', /\bfan\b|follower|admirer|\bstan\b/i],
];

const ROLE_TAG_CATEGORY = { ally: 'friend', detractor: 'rival', mentor: 'mentor', rival: 'rival', family: 'family', partner: 'collab' };

function storyCategory(row) {
  if (!row) return null;
  const stage = row.stage && String(row.stage).toLowerCase();
  if (stage && Object.prototype.hasOwnProperty.call(STAGE_CATEGORY, stage) && STAGE_CATEGORY[stage]) return STAGE_CATEGORY[stage];
  const type = String(row.relationship_type || '');
  const past = /^past$/i.test(String(row.status || ''));
  if (row.is_romantic) return past ? 'ex' : 'romance';
  if (row.family_role) return 'family';
  for (const [category, re] of TYPE_PATTERNS) {
    if (re.test(type)) return category === 'romance' && past ? 'ex' : category;
  }
  if (row.is_blood_relation) return 'family';
  return ROLE_TAG_CATEGORY[String(row.role_tag || '').toLowerCase()] || null;
}

// Each story kind on The Pulse: the kind to make, and the kinds that agree
// with it (a story sister can be a Pulse collab; a story rival cannot be a
// Pulse bestie).
const PULSE_FOR = Object.freeze({
  romance:      { kind: 'couple', fits: ['couple', 'situationship', 'secret_link'] },
  ex:           { kind: 'ex', fits: ['ex', 'baby_daddy', 'baby_mama', 'situationship', 'former_friends'] },
  family:       { kind: 'family', fits: ['family', 'bestie', 'collab', 'management', 'mentor', 'secret_link'] },
  friend:       { kind: 'bestie', fits: ['bestie', 'collab', 'orbit', 'mentor', 'secret_link'] },
  rival:        { kind: 'rival', fits: ['rival', 'feud', 'shade', 'copycat', 'former_friends'] },
  enemy:        { kind: 'feud', fits: ['feud', 'rival', 'shade', 'former_friends'] },
  mentor:       { kind: 'mentor', fits: ['mentor', 'management', 'collab', 'bestie'] },
  manager:      { kind: 'management', fits: ['management', 'collab', 'mentor'] },
  collab:       { kind: 'collab', fits: ['collab', 'bestie', 'management', 'mentor', 'orbit'] },
  fan:          { kind: 'orbit', fits: ['orbit', 'copycat', 'secret_link'] },
  acquaintance: { kind: 'orbit', fits: ['orbit', 'collab', 'rival', 'shade', 'copycat'] },
});

const CATEGORY_WORDS = {
  romance: 'love interest', ex: 'exes', family: 'family', friend: 'friends', rival: 'rivals', enemy: 'enemies',
  mentor: 'mentor', manager: 'manager', collab: 'work together', fan: 'fan', acquaintance: 'acquaintances',
};

function pulseKindFor(row) {
  const category = storyCategory(row);
  return category && PULSE_FOR[category] ? { category, ...PULSE_FOR[category] } : null;
}

/** The story pair in words: its family role or kind, its stage when it moved on. */
function storyWords(row) {
  const category = storyCategory(row);
  const own = row.family_role || row.relationship_type || CATEGORY_WORDS[category] || 'connected';
  const parts = [String(own).replace(/_/g, ' ')];
  if (row.is_romantic && category === 'romance' && !/love/i.test(parts[0])) parts.push('love interest');
  if (row.stage) parts.push(`now ${String(row.stage).replace(/_/g, ' ')}`);
  else if (row.status && row.status !== 'Active') parts.push(String(row.status).toLowerCase());
  return parts.join(', ');
}

// ── Lala's tie (social_profiles.lala_relationship) from the story pair ────
// The scriptTie is the LALA_TIES key the script writer reads (null where
// LALA_TIES has no word for it: a romance or family, said in words instead).
const LALA_TIE = Object.freeze({
  romance: { tie: 'direct', scriptTie: null }, family: { tie: 'direct', scriptTie: null }, ex: { tie: 'direct', scriptTie: null },
  friend: { tie: 'direct', scriptTie: 'direct' }, collab: { tie: 'direct', scriptTie: 'direct' },
  mentor: { tie: 'direct', scriptTie: 'direct' }, manager: { tie: 'direct', scriptTie: 'direct' },
  rival: { tie: 'competitive', scriptTie: 'competitive' }, enemy: { tie: 'competitive', scriptTie: 'competitive' },
  fan: { tie: 'one_sided', scriptTie: 'one_sided' }, acquaintance: { tie: 'aware', scriptTie: 'aware' },
});
// lala_relationship values that agree with each tie.
// The tie values as words (the stored value means "knows Lala in person",
// not "direct" in any other sense).
const TIE_WORDS = {
  direct: 'knows Lala in person', aware: 'knows of Lala, not met', one_sided: 'follows Lala, one-sided',
  mutual_unaware: "in Lala's circles, not close", competitive: "Lala's rival", justawoman: 'JustAWoman',
};
const tieWords = (tie) => TIE_WORDS[tie] || String(tie || '').replace(/_/g, ' ');
const LALA_FITS = { direct: ['direct'], competitive: ['competitive'], one_sided: ['one_sided'], aware: ['aware', 'one_sided', 'mutual_unaware'] };

// ── relationships_map's name lists, from the story pairs ─────────────────
const MAP_KEY = {
  romance: 'love_interests', ex: 'love_interests', family: 'family', friend: 'allies', rival: 'rivals', enemy: 'rivals',
  mentor: 'mentors', manager: 'business_partners', collab: 'business_partners',
};
const MAP_LISTS = ['allies', 'rivals', 'mentors', 'love_interests', 'business_partners', 'family'];

// ── Reads ─────────────────────────────────────────────────────────────────
const STORY_SQL = `
  SELECT cr.id, cr.character_id_a, cr.character_id_b, cr.relationship_type, cr.status, cr.is_romantic,
         cr.family_role, cr.is_blood_relation, cr.role_tag, cr.situation, cr.updated_at,
         st.relationship_stage AS stage,
         COALESCE(NULLIF(ca.selected_name, ''), ca.display_name) AS name_a,
         COALESCE(NULLIF(cb.selected_name, ''), cb.display_name) AS name_b,
         ca.display_name AS display_a, cb.display_name AS display_b,
         ca.character_key AS key_a, cb.character_key AS key_b,
         pa.id AS profile_a, pb.id AS profile_b, pa.handle AS handle_a, pb.handle AS handle_b
    FROM character_relationships cr
    JOIN registry_characters ca ON ca.id = cr.character_id_a AND ca.deleted_at IS NULL
    JOIN registry_characters cb ON cb.id = cr.character_id_b AND cb.deleted_at IS NULL
    LEFT JOIN social_profiles pa ON pa.id = ca.feed_profile_id AND pa.deleted_at IS NULL
    LEFT JOIN social_profiles pb ON pb.id = cb.feed_profile_id AND pb.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT e.relationship_stage FROM relationship_events e
       WHERE e.relationship_id = cr.id AND e.relationship_stage IS NOT NULL AND e.relationship_stage <> '' AND e.deleted_at IS NULL
       ORDER BY e.created_at DESC NULLS LAST LIMIT 1
    ) st ON true
   WHERE cr.deleted_at IS NULL AND cr.confirmed = true`;

const storyRows = (db, extra = '', replacements = {}, transaction) =>
  rowsOf(db, `${STORY_SQL} ${extra} ORDER BY cr.updated_at DESC`, replacements, transaction);

const PULSE_SQL = `
  SELECT spr.id, spr.source_profile_id, spr.target_profile_id, spr.relationship_type::text AS relationship_type,
         spr.public_visibility::text AS public_visibility, spr.character_relationship_id, spr.updated_at,
         ps.handle AS source_handle, pt.handle AS target_handle
    FROM social_profile_relationships spr
    JOIN social_profiles ps ON ps.id = spr.source_profile_id AND ps.deleted_at IS NULL
    JOIN social_profiles pt ON pt.id = spr.target_profile_id AND pt.deleted_at IS NULL`;

const pairKey = (a, b) => [Number(a), Number(b)].sort((x, y) => x - y).join(':');
const at = (h) => (h ? `@${String(h).replace(/^@+/, '')}` : null);

/** Lala's registry character id, the newest live one, or null. */
async function lalaCharacterId(db, transaction) {
  const [row] = await rowsOf(db, `SELECT id FROM registry_characters WHERE character_key = 'lala' AND deleted_at IS NULL
                                   ORDER BY (feed_profile_id IS NULL), updated_at DESC LIMIT 1`, {}, transaction);
  return row?.id || null;
}

// ── The link ─────────────────────────────────────────────────────────────
/**
 * The story pair for a Pulse pair among `stories` (both of the pair's
 * profiles): the newest whose kind agrees with the Pulse kind, else the
 * newest with a Pulse kind at all, else null.
 */
function storyFor(pulse, stories) {
  const withKind = stories.filter((s) => pulseKindFor(s));
  return withKind.find((s) => pulseKindFor(s).fits.includes(pulse.relationship_type)) || withKind[0] || null;
}

/**
 * Link each Pulse pair with no story pair to the story pair of the same two
 * people, when both have a registry character with that profile. Rows
 * already linked are left alone, so it can run again. Returns { linked }.
 */
async function linkStoryAndPulse(db, { transaction } = {}) {
  const stories = (await storyRows(db, 'AND pa.id IS NOT NULL AND pb.id IS NOT NULL AND pa.id <> pb.id', {}, transaction));
  if (!stories.length) return { linked: 0 };
  const byPair = new Map();
  for (const s of stories) {
    const k = pairKey(s.profile_a, s.profile_b);
    if (!byPair.has(k)) byPair.set(k, []);
    byPair.get(k).push(s);
  }
  const pulses = await rowsOf(db, `${PULSE_SQL} WHERE spr.character_relationship_id IS NULL`, {}, transaction);
  let linked = 0;
  for (const p of pulses) {
    const story = storyFor(p, byPair.get(pairKey(p.source_profile_id, p.target_profile_id)) || []);
    if (!story) continue;
    await sq(db).query(
      'UPDATE social_profile_relationships SET character_relationship_id = :story WHERE id = :id AND character_relationship_id IS NULL',
      { replacements: { story: story.id, id: p.id }, transaction });
    linked++;
  }
  return { linked };
}

/**
 * After a story pair is saved: when both people have a Pulse profile and
 * the pair has a kind The Pulse knows, its Pulse pair. One already linked
 * is kept as it is; else an unlinked one for the two profiles is linked
 * (one whose kind agrees first); else one is made with the story's kind,
 * public unless it is a romance (made hidden: the story may keep it secret,
 * and Evoni sets what the public sees). An existing Pulse pair's kind and
 * public status are never changed here; a difference shows on the drift
 * report. Returns { pulse_relationship_id, made } or { skipped }.
 */
async function syncStoryPair(db, storyId, { transaction } = {}) {
  const [story] = await storyRows(db, 'AND cr.id = :id', { id: storyId }, transaction);
  if (!story) return { skipped: 'not a confirmed story pair' };
  if (!story.profile_a || !story.profile_b) return { skipped: 'one of them has no Pulse profile' };
  if (Number(story.profile_a) === Number(story.profile_b)) return { skipped: 'both share one Pulse profile' };
  const pulse = pulseKindFor(story);
  if (!pulse) return { skipped: 'no Pulse kind for this relationship' };

  const [linked] = await rowsOf(db, `${PULSE_SQL} WHERE spr.character_relationship_id = :id ORDER BY spr.id LIMIT 1`, { id: story.id }, transaction);
  if (linked) return { pulse_relationship_id: linked.id, made: false };

  // Every Pulse pair the two already have, either way round.
  const pairRows = await rowsOf(db,
    `${PULSE_SQL} WHERE (spr.source_profile_id = :a AND spr.target_profile_id = :b) OR (spr.source_profile_id = :b AND spr.target_profile_id = :a)
      ORDER BY spr.updated_at DESC`, { a: story.profile_a, b: story.profile_b }, transaction);
  const pick = pairRows.find((r) => !r.character_relationship_id && pulse.fits.includes(r.relationship_type))
    || pairRows.find((r) => !r.character_relationship_id);
  if (pick) {
    await sq(db).query('UPDATE social_profile_relationships SET character_relationship_id = :story WHERE id = :id',
      { replacements: { story: story.id, id: pick.id }, transaction });
    return { pulse_relationship_id: pick.id, made: false };
  }
  // All of them belong to another story pair of the two: nothing to add.
  if (pairRows.length) return { pulse_relationship_id: pairRows[0].id, made: false };
  const [[made]] = await sq(db).query(
    `INSERT INTO social_profile_relationships
       (source_profile_id, target_profile_id, relationship_type, direction, public_visibility, narrative_function,
        auto_generated, character_relationship_id, created_at, updated_at)
     VALUES (:a, :b, :kind, 'mutual', :visibility, :why, false, :story, NOW(), NOW())
     ON CONFLICT (source_profile_id, target_profile_id, relationship_type) DO NOTHING
     RETURNING id`,
    { replacements: {
      a: story.profile_a, b: story.profile_b, kind: pulse.kind, story: story.id,
      visibility: pulse.category === 'romance' ? 'hidden' : 'public',
      why: `From the story: ${storyWords(story)}`,
    }, transaction });
  return made ? { pulse_relationship_id: made.id, made: true } : { skipped: 'the pair already has that kind' };
}

/** syncStoryPair for a route: never fails the save; logs instead. */
async function afterStorySave(db, storyId) {
  try {
    return await syncStoryPair(db, storyId);
  } catch (err) {
    console.error('[relationshipTruth] the Pulse pair could not be kept in step:', err.message);
    return { skipped: 'error' };
  }
}

// ── Lala's story ties ────────────────────────────────────────────────────
/**
 * Lala's story tie to each of `characterIds` that has a confirmed story pair
 * with her: Map(id → { category, tie, scriptTie, words, note }), the newest
 * pair when there are two.
 */
async function lalaStoryTies(db, characterIds, { transaction } = {}) {
  const ids = [...new Set((characterIds || []).filter(Boolean))];
  const out = new Map();
  if (!ids.length) return out;
  let lala;
  let rows;
  try {
    lala = await lalaCharacterId(db, transaction);
    if (!lala) return out;
    rows = await storyRows(db,
    `AND ((cr.character_id_a = :lala AND cr.character_id_b IN (:ids)) OR (cr.character_id_b = :lala AND cr.character_id_a IN (:ids)))`,
    { lala, ids }, transaction);
  } catch (err) {
    console.error("[relationshipTruth] Lala's story pairs could not be read:", err.message);
    return out;
  }
  for (const r of rows) {
    const other = r.character_id_a === lala ? r.character_id_b : r.character_id_a;
    if (out.has(other)) continue;
    const category = storyCategory(r);
    const t = (category && LALA_TIE[category]) || null;
    out.set(other, {
      category, tie: t?.tie || null, scriptTie: t ? t.scriptTie : null, words: storyWords(r),
      note: String(r.situation || '').replace(/\s+/g, ' ').trim().slice(0, 300) || null,
    });
  }
  return out;
}

/**
 * A profile row's tie to Lala for the script writer: where a Lala story pair
 * exists it decides (lala_relationship becomes its LALA_TIES key, or null
 * for a romance or family, which lala_story_tie says in words); else the
 * row's own lala_relationship, and no lala_story_tie.
 */
function lalaTieFields(row, tie) {
  if (!tie) return { lala_relationship: row?.lala_relationship ?? null, lala_story_tie: null };
  return { lala_relationship: tie.scriptTie, lala_story_tie: tie.note ? `${tie.words} (${tie.note})` : tie.words };
}

// ── relationships_map from the story pairs ───────────────────────────────
const nameKey = (s) => String(s || '').trim().toLowerCase();

/**
 * A character's relationships_map name lists from its story pairs:
 * { lists: { allies: [...], rivals: [...], … }, people: [every story partner's
 * names, lower case] }.
 */
async function storyRelationshipsMap(db, characterId, { transaction } = {}) {
  const lists = Object.fromEntries(MAP_LISTS.map((k) => [k, []]));
  const people = new Set();
  if (!characterId) return { lists, people: [] };
  const rows = await storyRows(db, 'AND (cr.character_id_a = :id OR cr.character_id_b = :id)', { id: characterId }, transaction);
  for (const r of rows) {
    const mine = r.character_id_a === characterId;
    const name = mine ? r.name_b : r.name_a;
    for (const n of [name, mine ? r.display_b : r.display_a]) if (n) people.add(nameKey(n));
    const key = MAP_KEY[storyCategory(r)];
    if (key && name && !lists[key].includes(name)) lists[key].push(name);
  }
  return { lists, people: [...people] };
}

const entryName = (entry) => (typeof entry === 'string' ? entry : entry?.name);

/**
 * The stored map with the story's say on the people in it: each story
 * partner is listed where the story puts them and nowhere else; a name the
 * story does not know (someone with no registry character) stays where it
 * was written. Prose keys (dynamic_notes …) stay. A map in the old array
 * format is returned as it is.
 */
function withStoryMap(stored, story) {
  if (Array.isArray(stored)) return stored;
  const base = stored && typeof stored === 'object' ? { ...stored } : {};
  const people = new Set(story?.people || []);
  for (const k of MAP_LISTS) {
    const names = story?.lists?.[k] || [];
    // A generator's prose ("who has their back and why") is not a list: it
    // stays, beside the story's names when there are some.
    if (typeof base[k] === 'string') {
      if (names.length && base[k].trim()) { base[`${k}_notes`] = base[k]; base[k] = [...names]; }
      continue;
    }
    const own = (Array.isArray(base[k]) ? base[k] : []).filter((e) => !people.has(nameKey(entryName(e))));
    const merged = [...names, ...own];
    if (merged.length) base[k] = merged;
    else if (Array.isArray(base[k])) delete base[k];
  }
  return base;
}

/** For a reader: the character's relationships_map, its name lists from the story pairs. Never throws. */
async function relationshipsMapOf(db, character) {
  const stored = character?.relationships_map;
  if (!character?.id) return stored;
  try {
    return withStoryMap(stored, await storyRelationshipsMap(db, character.id));
  } catch (err) {
    console.error('[relationshipTruth] relationships_map could not be read from the story:', err.message);
    return stored;
  }
}

// ── The drift report ─────────────────────────────────────────────────────
const KEEP_TABLE = 'relationship_drift_keeps';

/** The items marked "different on purpose": Map(key → signature). Empty before the migration. */
async function keptItems(db, transaction) {
  try {
    const rows = await rowsOf(db, `SELECT drift_key, signature FROM ${KEEP_TABLE} WHERE deleted_at IS NULL`, {}, transaction);
    return new Map(rows.map((r) => [r.drift_key, r.signature]));
  } catch (err) {
    console.error('[relationshipTruth] the kept differences could not be read:', err.message);
    return new Map();
  }
}

const signatureOf = (item) => JSON.stringify(item.says.map((s) => [s.store, s.value]));
const person = (name, handle, characterId, profileId) => ({ name: name || at(handle) || 'someone', handle: at(handle), character_id: characterId || null, profile_id: profileId || null });

/**
 * Every place the stores disagree, newest story pair first. Each item:
 *   { key, kind, who: [person, person], says: [{ store, value }], fix: { label, … } }
 * kind: pulse_kind (the Pulse pair's kind disagrees with the story),
 * pulse_missing (a story pair with both profiles has no Pulse pair),
 * pulse_couple_elsewhere (on The Pulse a couple with someone the story does
 * not pair them with, while the story has a romance with someone else),
 * lala_tie (lala_relationship against the Lala story pair), relationships_map
 * (a name listed under another kind than the story's). An item marked
 * "different on purpose" is left out while what each store says is unchanged.
 * { includeKept } puts them back, marked kept: true.
 */
async function driftReport(db, { includeKept = false, transaction } = {}) {
  const items = [];
  const stories = await storyRows(db, '', {}, transaction);
  const pulses = await rowsOf(db, PULSE_SQL, {}, transaction);
  const pulsesByPair = new Map();
  for (const p of pulses) {
    const k = pairKey(p.source_profile_id, p.target_profile_id);
    if (!pulsesByPair.has(k)) pulsesByPair.set(k, []);
    pulsesByPair.get(k).push(p);
  }
  const storyPairs = new Map(); // profile pair → story rows
  for (const s of stories) {
    if (!s.profile_a || !s.profile_b) continue;
    const k = pairKey(s.profile_a, s.profile_b);
    if (!storyPairs.has(k)) storyPairs.set(k, []);
    storyPairs.get(k).push(s);
  }

  // 1 and 2: each pair of people with a story pair against their Pulse
  // pairs. Two story pairs for the same two (sister and collaborator) agree
  // with any Pulse kind either allows; the newest names the kind to make.
  for (const [k, list] of storyPairs) {
    const withKind = list.filter((s) => pulseKindFor(s));
    if (!withKind.length) continue;
    const s = withKind[0];
    if (Number(s.profile_a) === Number(s.profile_b)) continue;
    const pulse = pulseKindFor(s);
    const fits = new Set(withKind.flatMap((r) => pulseKindFor(r).fits));
    const who = [person(s.name_a, s.handle_a, s.character_id_a, s.profile_a), person(s.name_b, s.handle_b, s.character_id_b, s.profile_b)];
    const online = pulsesByPair.get(k) || [];
    const story = { store: 'Story (Relationships)', value: withKind.map(storyWords).join('; ') };
    if (!online.length) {
      items.push({
        key: `pulse_missing:${s.id}`, kind: 'pulse_missing', who,
        says: [story, { store: 'The Pulse', value: 'nothing' }],
        fix: { label: `Add them on The Pulse as ${pulse.kind.replace(/_/g, ' ')}`, story_id: s.id },
      });
      continue;
    }
    if (online.some((p) => fits.has(p.relationship_type))) continue;
    const target = online.find((p) => withKind.some((r) => r.id === p.character_relationship_id)) || online[0];
    items.push({
      key: `pulse_kind:${target.id}`, kind: 'pulse_kind', who,
      says: [story, { store: 'The Pulse', value: online.map((p) => `${p.relationship_type.replace(/_/g, ' ')}${p.public_visibility && p.public_visibility !== 'public' ? ` (${p.public_visibility})` : ''}`).join(', ') }],
      fix: { label: `Make it ${pulse.kind.replace(/_/g, ' ')} on The Pulse`, pulse_id: target.id, story_id: s.id, kind: pulse.kind },
    });
  }

  // 3: a Pulse couple with someone the story does not pair them with, while
  // the story has a romance with someone else.
  const romanceOf = new Map(); // profile id → story rows that are a romance
  for (const s of stories) {
    if (storyCategory(s) !== 'romance') continue;
    for (const [self, other, name] of [[s.profile_a, s.profile_b, s.name_b], [s.profile_b, s.profile_a, s.name_a]]) {
      if (!self) continue;
      if (!romanceOf.has(self)) romanceOf.set(self, []);
      romanceOf.get(self).push({ other, name, story: s });
    }
  }
  for (const p of pulses) {
    if (p.relationship_type !== 'couple') continue;
    const k = pairKey(p.source_profile_id, p.target_profile_id);
    if (storyPairs.has(k)) continue; // a story pair for these two: item 1 covers it
    for (const [self, other, selfHandle, otherHandle] of [
      [p.source_profile_id, p.target_profile_id, p.source_handle, p.target_handle],
      [p.target_profile_id, p.source_profile_id, p.target_handle, p.source_handle]]) {
      const loves = (romanceOf.get(self) || []).filter((r) => Number(r.other) !== Number(other));
      if (!loves.length) continue;
      const love = loves[0];
      const selfName = Number(love.story.profile_a) === Number(self) ? love.story.name_a : love.story.name_b;
      items.push({
        key: `pulse_couple_elsewhere:${p.id}:${self}`, kind: 'pulse_couple_elsewhere',
        who: [person(selfName, selfHandle, null, self), person(null, otherHandle, null, other)],
        says: [
          { store: 'Story (Relationships)', value: `${selfName}'s love interest is ${love.name}` },
          { store: 'The Pulse', value: `a couple with ${at(otherHandle)}` },
        ],
        fix: { label: `Make ${at(selfHandle)} and ${at(otherHandle)} exes on The Pulse`, pulse_id: p.id, kind: 'ex' },
      });
      break;
    }
  }

  // 4: lala_relationship against the Lala story pair.
  const lala = await lalaCharacterId(db, transaction);
  if (lala) {
    const others = stories.filter((s) => s.character_id_a === lala || s.character_id_b === lala)
      .map((s) => (s.character_id_a === lala ? s.character_id_b : s.character_id_a));
    const ties = await lalaStoryTies(db, others, { transaction });
    if (ties.size) {
      const profiles = await rowsOf(db,
        `SELECT rc.id AS character_id, COALESCE(NULLIF(rc.selected_name, ''), rc.display_name) AS name,
                sp.id AS profile_id, sp.handle, sp.lala_relationship::text AS lala_relationship
           FROM registry_characters rc JOIN social_profiles sp ON sp.id = rc.feed_profile_id AND sp.deleted_at IS NULL
          WHERE rc.id IN (:ids) AND rc.deleted_at IS NULL AND COALESCE(rc.character_key, '') <> 'lala'`,
        { ids: [...ties.keys()] }, transaction);
      for (const pr of profiles) {
        const t = ties.get(pr.character_id);
        if (!t?.tie || (LALA_FITS[t.tie] || [t.tie]).includes(pr.lala_relationship)) continue;
        items.push({
          key: `lala_tie:${pr.profile_id}`, kind: 'lala_tie',
          who: [person('Lala', null, lala, null), person(pr.name, pr.handle, pr.character_id, pr.profile_id)],
          says: [
            { store: 'Story (Relationships)', value: t.words },
            { store: "Pulse profile's tie to Lala", value: pr.lala_relationship ? tieWords(pr.lala_relationship) : 'not set' },
          ],
          fix: { label: `Set their tie to Lala to "${tieWords(t.tie)}"`, profile_id: pr.profile_id, tie: t.tie },
        });
      }
    }
  }

  // 5: relationships_map names listed under another kind than the story's.
  const maps = await rowsOf(db,
    `SELECT id, COALESCE(NULLIF(selected_name, ''), display_name) AS name, relationships_map
       FROM registry_characters WHERE deleted_at IS NULL AND relationships_map IS NOT NULL
        AND jsonb_typeof(relationships_map) = 'object' AND relationships_map <> '{}'::jsonb`, {}, transaction);
  const storiesByChar = new Map();
  for (const s of stories) {
    for (const [self, otherName, otherDisplay] of [[s.character_id_a, s.name_b, s.display_b], [s.character_id_b, s.name_a, s.display_a]]) {
      if (!storiesByChar.has(self)) storiesByChar.set(self, []);
      storiesByChar.get(self).push({ names: [nameKey(otherName), nameKey(otherDisplay)], name: otherName, key: MAP_KEY[storyCategory(s)] || null, words: storyWords(s) });
    }
  }
  for (const c of maps) {
    const mine = storiesByChar.get(c.id) || [];
    if (!mine.length) continue;
    const wrong = [];
    for (const listKey of MAP_LISTS) {
      const listed = Array.isArray(c.relationships_map[listKey]) ? c.relationships_map[listKey] : [];
      for (const entry of listed) {
        const name = typeof entry === 'string' ? entry : entry?.name;
        const s = mine.find((m) => m.names.includes(nameKey(name)));
        if (s && s.key && s.key !== listKey) wrong.push({ story: `${s.name}: ${s.words}`, map: `${s.name} under ${listKey.replace(/_/g, ' ')}` });
      }
    }
    if (!wrong.length) continue;
    items.push({
      key: `relationships_map:${c.id}`, kind: 'relationships_map',
      who: [person(c.name, null, c.id, null)],
      says: [
        { store: 'Story (Relationships)', value: wrong.map((w) => w.story).join('; ') },
        { store: 'Character relationships map', value: wrong.map((w) => w.map).join('; ') },
      ],
      fix: { label: 'Rewrite their relationships map from the story', character_id: c.id },
    });
  }

  const kept = await keptItems(db, transaction);
  const out = [];
  for (const item of items) {
    const isKept = kept.has(item.key) && kept.get(item.key) === signatureOf(item);
    if (isKept && !includeKept) continue;
    out.push(isKept ? { ...item, kept: true } : item);
  }
  return out;
}

class DriftError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** Apply one item's suggested fix, read fresh from the stores. Returns { applied: key }. */
async function applyDriftFix(db, key) {
  const item = (await driftReport(db, { includeKept: true })).find((i) => i.key === key);
  if (!item) throw new DriftError(404, 'That disagreement is not there any more. Reload the list.');
  const f = item.fix;
  if (item.kind === 'pulse_missing') {
    const r = await syncStoryPair(db, f.story_id);
    if (!r.pulse_relationship_id) throw new DriftError(409, `They could not be added on The Pulse: ${r.skipped}.`);
  } else if (item.kind === 'pulse_kind' || item.kind === 'pulse_couple_elsewhere') {
    // Only the kind changes; who sees it (public, rumored, hidden) stays.
    const [twin] = await rowsOf(db,
      `SELECT spr.id FROM social_profile_relationships spr JOIN social_profile_relationships me ON me.id = :id
        WHERE spr.id <> me.id AND spr.relationship_type::text = :kind
          AND ((spr.source_profile_id = me.source_profile_id AND spr.target_profile_id = me.target_profile_id)
            OR (spr.source_profile_id = me.target_profile_id AND spr.target_profile_id = me.source_profile_id))`,
      { id: f.pulse_id, kind: f.kind });
    if (twin) throw new DriftError(409, `These two already have ${f.kind.replace(/_/g, ' ')} on The Pulse.`);
    await sq(db).query(
      `UPDATE social_profile_relationships SET relationship_type = :kind, updated_at = NOW()${f.story_id ? ', character_relationship_id = :story' : ''} WHERE id = :id`,
      { replacements: { kind: f.kind, id: f.pulse_id, story: f.story_id || null } });
  } else if (item.kind === 'lala_tie') {
    await sq(db).query('UPDATE social_profiles SET lala_relationship = :tie, updated_at = NOW() WHERE id = :id',
      { replacements: { tie: f.tie, id: f.profile_id } });
  } else if (item.kind === 'relationships_map') {
    await sq(db).transaction(async (transaction) => {
      const [row] = await rowsOf(db, 'SELECT relationships_map FROM registry_characters WHERE id = :id FOR UPDATE', { id: f.character_id }, transaction);
      const next = withStoryMap(row?.relationships_map, await storyRelationshipsMap(db, f.character_id, { transaction }));
      await sq(db).query('UPDATE registry_characters SET relationships_map = :map, updated_at = NOW() WHERE id = :id',
        { replacements: { map: JSON.stringify(next), id: f.character_id }, transaction });
    });
  }
  await sq(db).query(`UPDATE ${KEEP_TABLE} SET deleted_at = NOW(), updated_at = NOW() WHERE drift_key = :key AND deleted_at IS NULL`,
    { replacements: { key } }).catch((err) => console.error('[relationshipTruth] the kept mark could not be cleared:', err.message));
  return { applied: key };
}

/**
 * Mark one item "different on purpose": it leaves the report until what a
 * store says changes. Returns { kept: key }.
 */
async function keepDifferent(db, key, { note = null, by = null } = {}) {
  const item = (await driftReport(db, { includeKept: true })).find((i) => i.key === key);
  if (!item) throw new DriftError(404, 'That disagreement is not there any more. Reload the list.');
  await sq(db).query(
    `INSERT INTO ${KEEP_TABLE} (drift_key, signature, said, note, kept_by, created_at, updated_at)
     VALUES (:key, :signature, CAST(:said AS JSONB), :note, :by, NOW(), NOW())
     ON CONFLICT (drift_key) DO UPDATE SET signature = EXCLUDED.signature, said = EXCLUDED.said, note = EXCLUDED.note,
       kept_by = EXCLUDED.kept_by, deleted_at = NULL, updated_at = NOW()`,
    { replacements: { key, signature: signatureOf(item), said: JSON.stringify(item.says), note: note ? String(note).slice(0, 500) : null, by } });
  return { kept: key };
}

module.exports = {
  storyCategory, pulseKindFor, storyWords, tieWords, PULSE_FOR, LALA_TIE,
  linkStoryAndPulse, syncStoryPair, afterStorySave,
  lalaStoryTies, lalaTieFields, storyRelationshipsMap, withStoryMap, relationshipsMapOf,
  driftReport, applyDriftFix, keepDifferent, DriftError,
};

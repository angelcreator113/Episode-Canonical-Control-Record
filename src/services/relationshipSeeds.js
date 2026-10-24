'use strict';

/**
 * Relationship seeds (Evoni, 2026-10-24: "How can we improve relationship
 * seeds", then for all six ideas "I want them all and show me first"). A
 * seed is an unconfirmed character_relationships row. This service makes,
 * confirms, keeps and dismisses them; routes/relationships calls it.
 *
 *   generateSeeds(db, body, { cast, lalaId })   one AI call grounded on the story
 *                                               (services/seedContext); { ids, skipped }
 *   createSeeds(db, { source, seeds })          the scene banner's and the Pulse's
 *                                               suggestions, as seeds; { ids, skipped }
 *   confirmSeed(db, id, edits)                  apply Evoni's edits and confirm, in one
 *                                               transaction; { id, family, pulse }
 *   setSeedState(db, id, state)                 'kept' (Keep as idea) or null (Bring back)
 *   dismissSeed(db, id, { reason, note })       too_soon → later; else soft-deleted with the reason
 *   seedPrompt(...) / cleanSeeds(...) / skipIndex(...)   pure, for the tests
 *   (types are read by services/relationshipTypes normalizeType)
 *
 * The skip rule, everywhere a seed is made: a pair with a live row (any
 * type: a relationship, a seed, a kept idea, one put off for later) is
 * skipped; so is a pair dismissed as wrong_for_them or already_covered. A
 * pair dismissed for any other reason (not_this_type, other, or before
 * reasons existed), or a relationship deleted, comes back only as a
 * different type: the unique index (a, b, type) still holds that row.
 */

const { v4: uuidv4 } = require('uuid');
const familyTies = require('./familyTies');
const truth = require('./relationshipTruth');
const { loadSeedContext, contextBlock, basisCatalog, episodeLabel } = require('./seedContext');
// One reading of a type everywhere (services/relationshipTypes; the type tidy-up uses it too).
const { APP_TYPES, normalizeType, familyRoleOf, words, roleWords, capital } = require('./relationshipTypes');

const MODELS = ['claude-sonnet-4-6'];
const MAX_TOKENS = 3000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const KINDS = Object.freeze(['any', 'romance', 'rivals', 'friends', 'mentors', 'family']);
const SOURCES = Object.freeze(['generate', 'family', 'scene', 'pulse', 'manual']);
const REASONS = Object.freeze(['wrong_for_them', 'too_soon', 'already_covered', 'not_this_type', 'other']);
const BLOCKING = new Set(['wrong_for_them', 'already_covered']);
const CONN_MODES = ['IRL', 'Online Only', 'Passing', 'Professional', 'One-sided'];
const TENSIONS = ['calm', 'simmering', 'volatile', 'fractured', 'healing'];
const LALA_CONN = ['none', 'knows_lala', 'knows_protagonist', 'through_justwoman', 'interacts_content', 'independent', 'unaware'];
const STATUSES = ['Active', 'Past', 'One-sided', 'Complicated'];
const WHY_MAX = 140;
const MAX_SEEDS_IN = 20;
const MAX_CONFIRM_ALL = 50;

// Which story kinds each Generate kind takes.
const KIND_FITS = {
  romance: ['romance', 'ex'], rivals: ['rival', 'enemy'], friends: ['friend'], mentors: ['mentor', 'manager'],
};

class SeedError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; this.name = 'SeedError'; }
}

const sq = (db) => db?.sequelize || db;
const SELECT = (db) => ({ type: sq(db).QueryTypes.SELECT });
const nameOf = (c) => (c && (c.selected_name || c.display_name)) || '?';
const text = (v, n) => (typeof v === 'string' && v.trim() ? v.replace(/\s+/g, ' ').trim().slice(0, n) : null);
const pairKey = (a, b) => [String(a), String(b)].sort().join('|');
/**
 * What every pair already has, for the skip rule: the live pairs, the pairs
 * dismissed for good, and each (pair, type) a deleted row still holds.
 */
async function skipIndex(db, characterIds, { transaction } = {}) {
  const ids = [...new Set(characterIds.map(String))];
  const index = { live: new Set(), blocked: new Map(), heldTypes: new Set() };
  if (ids.length < 2) return index;
  const rows = await sq(db).query(
    `SELECT character_id_a, character_id_b, relationship_type, deleted_at, to_jsonb(cr)->>'dismiss_reason' AS dismiss_reason
       FROM character_relationships cr
      WHERE character_id_a IN (:ids) AND character_id_b IN (:ids)`,
    { replacements: { ids }, ...SELECT(db), transaction });
  for (const r of rows) {
    const k = pairKey(r.character_id_a, r.character_id_b);
    if (!r.deleted_at) index.live.add(k);
    else if (BLOCKING.has(r.dismiss_reason)) index.blocked.set(k, r.dismiss_reason);
    else index.heldTypes.add(`${k}|${words(r.relationship_type)}`);
  }
  return index;
}

const SKIP_WORDS = {
  same_person: 'Someone cannot have a relationship with themselves.',
  not_found: 'One of them is not in the character registry.',
  not_in_cast: 'One of them is not in the cast.',
  confidential: 'One of them is a confidential character.',
  already_there: 'They already have a relationship or seed.',
  dismissed_wrong_for_them: 'You dismissed this pair as wrong for them.',
  dismissed_already_covered: 'You dismissed this pair as already covered.',
  dismissed_same_type: 'You dismissed this pair as this type before.',
  duplicate: 'This pair is in the list twice.',
  unknown_type: 'The type is not one the page knows.',
  family_romance: 'They would be family, so this cannot be a romance.',
  not_this_kind: 'It is not the kind asked for.',
  conflict: 'A row for this pair and type is already there.',
};
const skip = (code, extra = {}) => ({ code, why: SKIP_WORDS[code], ...extra });

/** Why this pair and type is skipped, or null. */
function skipWhy(index, a, b, type) {
  const k = pairKey(a, b);
  if (index.live.has(k)) return skip('already_there');
  const blocked = index.blocked.get(k);
  if (blocked) return skip(`dismissed_${blocked}`);
  if (index.heldTypes.has(`${k}|${words(type)}`)) return skip('dismissed_same_type');
  return null;
}

/** A body's aim, checked against the cast: { kind, focus_character_id, episode_id, twist_id, count }. */
function aimOf(body = {}, castIds = []) {
  const kind = body.kind == null || body.kind === '' ? 'any' : String(body.kind);
  if (!KINDS.includes(kind)) throw new SeedError(`Kind must be one of ${KINDS.join(', ')}`);
  const idOrNull = (v, what) => {
    if (v == null || v === '') return null;
    if (!UUID_RE.test(String(v))) throw new SeedError(`${what} is not a valid id`);
    return String(v);
  };
  const focus = idOrNull(body.focus_character_id, 'focus_character_id');
  if (focus && !castIds.includes(focus)) throw new SeedError('That person is not in the cast.');
  const n = body.count == null || body.count === '' ? 5 : Number(body.count);
  const count = Number.isFinite(n) ? Math.min(8, Math.max(3, Math.round(n))) : 5;
  return { kind, focus_character_id: focus, episode_id: idOrNull(body.episode_id, 'episode_id'), twist_id: idOrNull(body.twist_id, 'twist_id'), count };
}

const KIND_WORDS = {
  any: 'any kind of relationship', romance: 'romances (love interests, temptations, exes)', rivals: 'rivalries',
  friends: 'friendships', mentors: 'mentors and managers', family: 'family ties (and marriages)',
};

/** The prompt. Pure, for the tests. */
function seedPrompt({ characters, ctx, aim, lalaId = null }) {
  const names = ctx.names || new Map(characters.map((c) => [String(c.id), nameOf(c)]));
  const castLines = characters.map((c) => {
    const bits = [c.role_type, c.core_belief && `believes: ${String(c.core_belief).slice(0, 160)}`,
      c.pressure_type && `pressure: ${c.pressure_type}`, c.personality && `personality: ${String(c.personality).slice(0, 160)}`]
      .filter(Boolean).join('; ');
    return `- [${c.id}] ${nameOf(c)}${String(c.id) === String(lalaId) ? ' (Lala, the protagonist)' : ''}${bits ? `: ${bits}` : ''}`;
  }).join('\n');

  const aimLines = [`Kind: ${KIND_WORDS[aim.kind]}.`];
  if (aim.focus_character_id) aimLines.push(`Every seed involves ${names.get(aim.focus_character_id) || '?'} [${aim.focus_character_id}].`);
  if (ctx.episode) {
    const guests = (ctx.guests || []).map((id) => `${names.get(id) || '?'} [${id}]`);
    aimLines.push(`Built for [episode ${ctx.episode.id}] ${episodeLabel(ctx.episode)}${ctx.episode.event ? ` (the event: ${ctx.episode.event})` : ''}: pair the people at it${guests.length ? `, its guests ${guests.join(', ')}` : ''}${lalaId ? ' and Lala' : ''}.`);
  }
  if (ctx.twist) {
    aimLines.push(`Built to pay off [twist ${ctx.twist.id}] "${ctx.twist.title}"${ctx.twist.description ? `: ${ctx.twist.description}` : ''}${ctx.twist.character_ids.length ? `; it involves ${ctx.twist.character_ids.map((id) => names.get(id)).filter(Boolean).join(', ')}` : ''}.`);
  }
  const family = aim.kind === 'family';
  const typeField = family
    ? `"family_role": "what A is to B: mother, father, sister, brother, daughter, son, aunt, uncle, cousin, grandmother, grandfather, stepmother, stepsister, niece, nephew, chosen family; or wife, husband, partner, ex-wife, ex-husband for a marriage",
    "is_blood_relation": true,
    "is_romantic": false,
    "conflict_summary": "1-2 sentences: the tension between them",`
    : `"relationship_type": "one of: ${APP_TYPES.join(', ')}",
    "is_romantic": false,
    "flavour": "optional: a sharper name for it, e.g. fidelity test, emotional affair, the one who left",`;

  return `You suggest relationship seeds for the LalaVerse: the world of the show "Styling Adventures with Lala". A seed is an idea for a relationship between two of the cast that Evoni (the writer) may confirm. Ground every seed in what has already happened: the episodes, threads and twists below.

THE CAST (only these people; use their ids exactly):
${castLines}

${contextBlock(ctx)}

AIM:
${aimLines.join('\n')}

NEVER BREAK THESE:
- No romance between family: a pair listed under FAMILY is never romantic, and a family seed is never a romance unless it is a marriage.
- Nothing that contradicts a confirmed relationship or an episode record above.
- Only the cast above; nobody else, and never anyone left out of it.
- Never repeat a pair Evoni turned down as "wrong for them" or "already covered".
- A pair she turned down as "not this type" may come back only as a different type.
- A pair that already has a confirmed relationship is not a seed.

Suggest ${aim.count} NEW seeds. Answer with JSON only, no markdown:
{ "seeds": [
  {
    "a": "a cast id",
    "b": "another cast id",
    ${typeField}
    "connection_mode": "${CONN_MODES.join(' | ')}",
    "tension_state": "${TENSIONS.join(' | ')}",
    "lala_connection": "${LALA_CONN.join(' | ')}",
    "situation": "1-2 sentences: the dynamic, with its moral tension (who is tempted, who is faithful, who lied)",
    "pain_point_category": "identity | trust | ambition | loyalty | family | self-worth | fidelity | betrayal | guilt | temptation",
    "seed_why": "at most ${WHY_MAX} characters, plain English, for Evoni: why this pair now, naming the episode, thread or twist it builds on",
    "basis": { "episodes": ["episode ids above it builds on"], "threads": ["thread ids above"], "twists": ["twist ids above"], "facts": ["a short fact from above it rests on"] }
  }
] }
Use only ids that appear in brackets above; leave a list empty rather than invent one.`;
}

/** The basis the model gave, kept to ids that exist, with their labels. */
function basisOf(raw, catalog) {
  const b = raw && typeof raw === 'object' ? raw : {};
  const pick = (list, map) => {
    const seen = new Set();
    return (Array.isArray(list) ? list : []).map((x) => String(typeof x === 'object' && x ? x.id : x || '').trim())
      .filter((id) => map.has(id) && !seen.has(id) && seen.add(id)).slice(0, 4).map((id) => map.get(id));
  };
  return {
    episodes: pick(b.episodes, catalog.episodes),
    threads: pick(b.threads, catalog.threads),
    twists: pick(b.twists, catalog.twists),
    facts: (Array.isArray(b.facts) ? b.facts : []).map((f) => text(f, 140)).filter(Boolean).slice(0, 3),
  };
}

/** One line of why, at most WHY_MAX characters; from the basis when the model gave none. */
function whyOf(raw, basis) {
  const given = text(raw, 400);
  if (given) return given.length > WHY_MAX ? `${given.slice(0, WHY_MAX - 1).trimEnd()}…` : given;
  const on = [...basis.episodes.map((e) => episodeLabel(e)), ...basis.threads.map((t) => `the thread "${t.title}"`), ...basis.twists.map((t) => `the twist "${t.title}"`)];
  return on.length ? `Builds on ${on.join(', ')}`.slice(0, WHY_MAX) : null;
}

/**
 * The model's answer, as rows to insert and what was skipped. Pure apart
 * from `index` (skipIndex's), for the tests.
 */
function cleanSeeds(parsed, { characters, ctx, aim, index }) {
  const castIds = new Set(characters.map((c) => String(c.id)));
  const familyPairs = new Set((ctx.confirmed || []).filter((r) => familyRoleOf(r.family_role) && !r.is_romantic).map((r) => pairKey(r.character_id_a, r.character_id_b)));
  const catalog = basisCatalog(ctx);
  const list = Array.isArray(parsed?.seeds) ? parsed.seeds
    : Array.isArray(parsed?.candidates) ? parsed.candidates
      : Array.isArray(parsed?.family_bonds) ? parsed.family_bonds : [];
  const family = aim.kind === 'family';
  const seeds = [];
  const skipped = [];
  const seen = new Set();
  list.forEach((s, i) => {
    const a = String(s?.a ?? s?.character_a_id ?? '');
    const b = String(s?.b ?? s?.character_b_id ?? '');
    const out = (code) => skipped.push(skip(code, { index: i, character_id_a: a || null, character_id_b: b || null }));
    if (!castIds.has(a) || !castIds.has(b)) return out('not_in_cast');
    if (a === b) return out('same_person');
    if (aim.focus_character_id && a !== aim.focus_character_id && b !== aim.focus_character_id) return out('not_this_kind');

    let type;
    let romantic = s.is_romantic === true;
    let familyRole = null;
    let flavour = capital(text(s.flavour, 60));
    if (family) {
      const role = roleWords(s.family_role);
      if (familyTies.isSpouseRole(role)) {
        romantic = true;
        familyRole = role;
        type = ['husband', 'wife'].includes(role) ? role : 'love_interest';
      } else if (familyRoleOf(role)) {
        if (romantic) return out('family_romance');
        familyRole = role;
        type = APP_TYPES.includes(role) ? role : 'family';
      } else {
        return out('unknown_type');
      }
      // The generator's own label ("protective mother") reads as flavour.
      if (!flavour && s.relationship_type && roleWords(s.relationship_type) !== role) flavour = capital(text(s.relationship_type, 60));
    } else {
      const n = normalizeType(s.relationship_type, { romantic });
      if (!n || n.type === 'family') return out('unknown_type');
      type = n.type;
      romantic = n.is_romantic;
      if (!flavour && n.flavour) flavour = n.flavour;
      familyRole = familyRoleOf(type);
      if (familyRole && romantic) return out('family_romance');
      const category = truth.storyCategory({ relationship_type: type, is_romantic: romantic, family_role: familyRole });
      if (KIND_FITS[aim.kind] && !KIND_FITS[aim.kind].includes(category)) return out('not_this_kind');
    }
    const k = pairKey(a, b);
    if (romantic && familyPairs.has(k)) return out('family_romance');
    if (seen.has(k)) return out('duplicate');
    const why = skipWhy(index, a, b, type);
    if (why) return skipped.push({ ...why, index: i, character_id_a: a, character_id_b: b });
    seen.add(k);

    const basis = basisOf(s.basis || s.seed_basis, catalog);
    const situation = text(s.situation, 600);
    seeds.push({
      character_id_a: a, character_id_b: b, relationship_type: type, is_romantic: romantic,
      family_role: familyRole,
      reverse_family_role: familyRole && !romantic ? familyTies.reverseRole(familyRole) : null,
      family_kind: familyRole && !romantic ? (familyTies.kindOf(familyRole) !== 'blood' ? familyTies.kindOf(familyRole) : (s.is_blood_relation === false ? null : 'blood')) : null,
      is_blood_relation: Boolean(familyRole && !romantic && familyTies.kindOf(familyRole) === 'blood' && s.is_blood_relation !== false),
      connection_mode: CONN_MODES.includes(s.connection_mode) ? s.connection_mode : 'IRL',
      lala_connection: LALA_CONN.includes(s.lala_connection) ? s.lala_connection : 'none',
      tension_state: TENSIONS.includes(s.tension_state) ? s.tension_state : null,
      situation: flavour && !(situation || '').toLowerCase().startsWith(flavour.toLowerCase()) ? `${flavour}: ${situation || ''}`.trim().replace(/:$/, '') : situation,
      pain_point_category: text(s.pain_point_category, 100),
      lala_mirror: text(s.lala_mirror, 400),
      career_echo_potential: text(s.career_echo_potential, 400),
      conflict_summary: text(s.conflict_summary, 600),
      notes: text(s.notes, 600),
      seed_source: family ? 'family' : 'generate',
      seed_why: whyOf(s.seed_why, basis),
      seed_basis: basis,
    });
  });
  return { seeds: seeds.slice(0, 8), skipped };
}

/** Inserts one seed; its id, or null when the unique index already holds (a, b, type). */
async function insertSeed(db, s, { aim = null, transaction } = {}) {
  const [row] = await sq(db).query(
    `INSERT INTO character_relationships
       (id, character_id_a, character_id_b, relationship_type, connection_mode, lala_connection, status,
        situation, tension_state, pain_point_category, lala_mirror, career_echo_potential,
        family_role, reverse_family_role, family_kind, is_blood_relation, is_romantic, conflict_summary, notes,
        confirmed, seed_source, seed_why, seed_basis, seed_aim, created_at, updated_at)
     VALUES
       (:id, :a, :b, :type, :conn, :lala, 'Active',
        :situation, :tension, :pain, :mirror, :echo,
        :family_role, :reverse_role, :family_kind, :blood, :romantic, :conflict, :notes,
        false, :source, :why, CAST(:basis AS jsonb), CAST(:aim AS jsonb), NOW(), NOW())
     ON CONFLICT (character_id_a, character_id_b, relationship_type) DO NOTHING
     RETURNING id`,
    {
      replacements: {
        id: uuidv4(), a: s.character_id_a, b: s.character_id_b, type: s.relationship_type,
        conn: s.connection_mode || 'IRL', lala: s.lala_connection || 'none',
        situation: s.situation || null, tension: s.tension_state || null, pain: s.pain_point_category || null,
        mirror: s.lala_mirror || null, echo: s.career_echo_potential || null,
        family_role: s.family_role || null, reverse_role: s.reverse_family_role || null, family_kind: s.family_kind || null,
        blood: s.is_blood_relation === true, romantic: s.is_romantic === true, conflict: s.conflict_summary || null, notes: s.notes || null,
        source: s.seed_source, why: s.seed_why || null,
        basis: s.seed_basis ? JSON.stringify(s.seed_basis) : null, aim: aim ? JSON.stringify(aim) : null,
      },
      ...SELECT(db), transaction,
    });
  return row ? row.id : null;
}

/** The two-attempt loop: up to 2 tries per model, a 2s pause on 529/503; a budget refusal is never retried. */
async function callModel(prompt) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let lastErr = null;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await client.messages.create({ model, max_tokens: MAX_TOKENS, messages: [{ role: 'user', content: prompt }] });
      } catch (apiErr) {
        console.warn(`[relationshipSeeds] Generate with ${model}, try ${attempt + 1}, failed:`, apiErr.message);
        // Marked, so the route answers it as an AI failure (its aiFailure), not a server error.
        if (apiErr && typeof apiErr === 'object') apiErr.fromAI = true;
        if (apiErr?.code === 'AI_BUDGET_EXCEEDED') throw apiErr;
        lastErr = apiErr;
        const status = apiErr?.status || apiErr?.error?.status;
        if ((status === 529 || status === 503) && attempt < 1) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        break;
      }
    }
  }
  throw lastErr || new Error('No answer from the AI');
}

/**
 * Generate: one AI call on the cast (characters, confidential ones already
 * left out) and the story so far. Throws the AI's own error (the route maps
 * it, aiFailure), or a SeedError. Returns { ids, skipped, prompt }.
 */
async function generateSeeds(db, body, { characters, lalaId = null }) {
  const castIds = characters.map((c) => String(c.id));
  const aim = aimOf(body, castIds);
  const ctx = await loadSeedContext(sq(db), { cast: characters, episodeId: aim.episode_id, twistId: aim.twist_id });
  if (aim.episode_id && !ctx.episode) throw new SeedError('That episode was not found.', 404);
  if (aim.twist_id && !ctx.twist) throw new SeedError('That twist was not found.', 404);
  // Family seeds also see each person's heritage and its rule (services/familyHeritage).
  const heritage = aim.kind === 'family'
    ? await require('./familyHeritage').proposeFamilyHeritage(sq(db), characters) : null;
  const prompt = `${seedPrompt({ characters, ctx, aim, lalaId })}${heritage ? `\n${heritage.section}` : ''}`;
  const message = await callModel(prompt);
  let parsed;
  try {
    const raw = (message?.content?.[0]?.text || '').trim();
    parsed = JSON.parse((raw.match(/\{[\s\S]*\}/) || [raw])[0]);
  } catch (err) {
    console.error('[relationshipSeeds] the answer could not be read:', err.message);
    throw new SeedError('Failed to parse AI response', 500);
  }
  if (heritage) {
    const list = [parsed?.seeds, parsed?.candidates, parsed?.family_bonds].find(Array.isArray) || [];
    // Any suggested heritage goes into the seed's notes as words; it is never saved to anyone.
    for (const s of list) {
      if (s && typeof s === 'object') s.notes = heritage.notesFor({ ...s, character_a_id: s.a ?? s.character_a_id, character_b_id: s.b ?? s.character_b_id });
    }
  }
  const index = await skipIndex(db, castIds);
  const { seeds, skipped } = cleanSeeds(parsed, { characters, ctx, aim, index });
  const storedAim = { kind: aim.kind, focus_character_id: aim.focus_character_id, episode_id: aim.episode_id, twist_id: aim.twist_id };
  const ids = [];
  for (const s of seeds) {
    const id = await insertSeed(db, s, { aim: storedAim });
    if (id) ids.push(id);
    else skipped.push(skip('conflict', { character_id_a: s.character_id_a, character_id_b: s.character_id_b }));
  }
  return { ids, skipped, prompt };
}

/**
 * The scene banner's and the Pulse's suggestions, as seeds (source scene,
 * pulse or manual). Evoni picked them, so a type the page does not know is
 * kept as written and confidential characters are allowed. Same skip rule.
 */
async function createSeeds(db, { source, seeds } = {}) {
  if (!['scene', 'pulse', 'manual'].includes(source)) throw new SeedError('source must be scene, pulse or manual');
  if (!Array.isArray(seeds) || !seeds.length) throw new SeedError('seeds must be a list of at least one');
  if (seeds.length > MAX_SEEDS_IN) throw new SeedError(`At most ${MAX_SEEDS_IN} seeds at a time`);
  const ids = [...new Set(seeds.flatMap((s) => [s?.character_id_a, s?.character_id_b]).filter((v) => UUID_RE.test(String(v || ''))).map(String))];
  const people = ids.length ? await sq(db).query(
    'SELECT id FROM registry_characters WHERE id IN (:ids) AND deleted_at IS NULL', { replacements: { ids }, ...SELECT(db) }) : [];
  const known = new Set(people.map((p) => String(p.id)));
  const index = await skipIndex(db, [...known]);
  const out = [];
  const skipped = [];
  const seen = new Set();
  for (const [i, s] of seeds.entries()) {
    const a = String(s?.character_id_a || '');
    const b = String(s?.character_id_b || '');
    const note = (code) => skipped.push(skip(code, { index: i }));
    if (!known.has(a) || !known.has(b)) { note('not_found'); continue; }
    if (a === b) { note('same_person'); continue; }
    const n = normalizeType(s.relationship_type, { romantic: s.is_romantic === true, keepUnknown: true });
    if (!n) { note('unknown_type'); continue; }
    const familyRole = n.type === 'family' ? null : familyRoleOf(n.type);
    if (familyRole && n.is_romantic) { note('family_romance'); continue; }
    const k = pairKey(a, b);
    if (seen.has(k)) { note('duplicate'); continue; }
    const why = skipWhy(index, a, b, n.type);
    if (why) { skipped.push({ ...why, index: i }); continue; }
    seen.add(k);
    const basisIn = s.seed_basis && typeof s.seed_basis === 'object' ? s.seed_basis : {};
    const listOf = (v, keep) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object' && UUID_RE.test(String(x.id || ''))).slice(0, 4).map(keep) : []);
    const situation = text(s.situation, 600);
    const id = await insertSeed(db, {
      character_id_a: a, character_id_b: b, relationship_type: n.type, is_romantic: n.is_romantic,
      family_role: familyRole, reverse_family_role: familyRole ? familyTies.reverseRole(familyRole) : null,
      family_kind: familyRole && familyTies.kindOf(familyRole) !== 'blood' ? familyTies.kindOf(familyRole) : null,
      situation: n.flavour && !situation ? n.flavour : situation,
      seed_source: source, seed_why: text(s.seed_why, WHY_MAX),
      seed_basis: {
        episodes: listOf(basisIn.episodes, (e) => ({ id: String(e.id), number: e.number ?? null, title: text(e.title, 200) })),
        threads: listOf(basisIn.threads, (t) => ({ id: String(t.id), title: text(t.title, 200) })),
        twists: listOf(basisIn.twists, (t) => ({ id: String(t.id), title: text(t.title, 200) })),
        facts: (Array.isArray(basisIn.facts) ? basisIn.facts : []).map((f) => text(f, 140)).filter(Boolean).slice(0, 3),
      },
    });
    if (id) out.push(id);
    else skipped.push(skip('conflict', { index: i }));
  }
  return { ids: out, skipped };
}

// What Confirm may change first (the Inspector's form, in edit mode). Each
// with the value an empty field becomes, as PUT /relationships/:id.
const CONFIRM_EDITABLE = {
  relationship_type: null, connection_mode: 'IRL', lala_connection: 'none', status: 'Active',
  tension_state: null, situation: null, pain_point_category: null, notes: null,
};
const isUniqueViolation = (err) => err?.name === 'SequelizeUniqueConstraintError' || err?.original?.code === '23505' || err?.parent?.code === '23505';

/**
 * Confirm a seed, after applying Evoni's edits, in one transaction. The
 * rules are POST /relationships' and PUT's: a romance with a family role
 * that is not a partner's is refused (409); a family type (or role) is
 * saved as a family tie, both directions (services/familyTies), the seed
 * becoming the tie. Then its Pulse pair follows (relationshipTruth
 * afterStorySave). Returns { id, family, pulse }; a SeedError when refused.
 */
async function confirmSeed(db, id, edits = {}) {
  if (!UUID_RE.test(String(id || ''))) throw new SeedError('Relationship not found', 404);
  const body = edits && typeof edits === 'object' ? edits : {};
  if (body.relationship_type !== undefined && !String(body.relationship_type || '').trim()) throw new SeedError('A relationship needs a type');
  for (const [k, list] of [['connection_mode', CONN_MODES], ['tension_state', TENSIONS], ['lala_connection', LALA_CONN], ['status', STATUSES]]) {
    const v = typeof body[k] === 'string' ? body[k].trim() : body[k];
    if (v != null && v !== '' && !list.includes(v)) throw new SeedError(`${k} must be one of ${list.join(', ')}`);
  }
  const sequelize = sq(db);
  let result;
  try {
    result = await sequelize.transaction(async (transaction) => {
      const [row] = await sequelize.query(
        `SELECT id, character_id_a, character_id_b, relationship_type, is_romantic, family_role, family_kind, confirmed, notes, tension_state
           FROM character_relationships WHERE id = :id AND deleted_at IS NULL FOR UPDATE`,
        { replacements: { id }, ...SELECT(db), transaction });
      if (!row) throw new SeedError('Relationship not found', 404);
      if (row.confirmed) return { id: row.id, family: false, already: true };

      const sets = [];
      const replacements = { id };
      for (const k of Object.keys(CONFIRM_EDITABLE)) {
        if (body[k] === undefined) continue;
        const v = typeof body[k] === 'string' ? body[k].trim() : body[k];
        replacements[k] = v === '' || v == null ? CONFIRM_EDITABLE[k] : v;
        sets.push(`${k} = :${k}`);
      }
      const type = replacements.relationship_type ?? row.relationship_type;
      const romantic = body.is_romantic !== undefined ? (body.is_romantic === true || body.is_romantic === 'true') : row.is_romantic;
      const roleSent = body.family_role !== undefined;
      const sentRole = roleSent ? roleWords(body.family_role) : null;
      const role = roleSent ? sentRole : row.family_role;
      // The family role it will carry: one sent or already on it, else its type's ("sister").
      const familyRole = familyRoleOf(role) || (familyTies.isSpouseRole(role) ? null : familyRoleOf(type));
      if (romantic && familyRole) {
        throw new SeedError(`They are family (${familyRole}), so this cannot be a romance. Change the family role first.`, 409);
      }
      sets.push('is_romantic = :is_romantic');
      replacements.is_romantic = romantic;
      if (!familyRole && roleSent) {
        // A partner's role (or none): the seed keeps it as written.
        sets.push('family_role = :family_role', 'reverse_family_role = NULL');
        replacements.family_role = sentRole || null;
      }
      sets.push('seed_state = NULL', 'dismiss_reason = NULL', 'dismiss_note = NULL');
      await sequelize.query(
        `UPDATE character_relationships SET ${sets.join(', ')}, updated_at = NOW() WHERE id = :id`,
        { replacements, transaction });

      if (!familyRole) {
        await sequelize.query('UPDATE character_relationships SET confirmed = true, updated_at = NOW() WHERE id = :id', { replacements: { id }, transaction });
        return { id: row.id, family: false };
      }
      // A family tie: the seed carries the role first, so saveFamilyTie finds it and confirms it.
      const sameRole = roleWords(row.family_role) === familyRole;
      await sequelize.query(
        'UPDATE character_relationships SET family_role = :role WHERE id = :id', { replacements: { id, role: familyRole }, transaction });
      const given = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
      const saved = await familyTies.saveFamilyTie(sequelize, {
        fromId: row.character_id_a, toId: row.character_id_b, role: familyRole,
        kind: sameRole && row.family_kind ? row.family_kind : null,
        notes: given(replacements.notes ?? undefined), tension: given(replacements.tension_state ?? undefined), transaction,
      });
      if (String(saved.id) !== String(row.id)) {
        // The pair already had a live family row: that one is the tie now, so the seed goes.
        await sequelize.query(
          'UPDATE character_relationships SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id', { replacements: { id }, transaction });
      }
      return { id: saved.id, family: true };
    });
  } catch (err) {
    if (err instanceof SeedError) throw err;
    if (err?.status && err?.message && !err.name?.startsWith('Sequelize')) throw new SeedError(err.message, err.status);
    if (isUniqueViolation(err)) throw new SeedError('A relationship of that type is already there between them.', 409);
    throw err;
  }
  const pulse = await truth.afterStorySave(db, result.id);
  return { ...result, pulse };
}

/** Confirm many as they are; each one alone, so one refused leaves the rest. */
async function confirmMany(db, ids) {
  if (!Array.isArray(ids) || !ids.length) throw new SeedError('ids must be a list of at least one');
  if (ids.length > MAX_CONFIRM_ALL) throw new SeedError(`At most ${MAX_CONFIRM_ALL} at a time`);
  const confirmed = [];
  const refused = [];
  for (const id of [...new Set(ids.map(String))]) {
    try {
      const r = await confirmSeed(db, id, {});
      confirmed.push(r);
    } catch (err) {
      console.error(`[relationshipSeeds] confirm-all: ${id} refused:`, err.message);
      refused.push({ id, error: err instanceof SeedError ? err.message : 'It could not be confirmed. Try it on its own.' });
    }
  }
  return { confirmed, refused };
}

/** "Keep as idea" ('kept') or "Bring back" (null); unconfirmed live rows only. */
async function setSeedState(db, id, state) {
  if (!UUID_RE.test(String(id || ''))) throw new SeedError('Relationship not found', 404);
  if (state !== 'kept' && state !== null) throw new SeedError("state must be 'kept' or null");
  const [row] = await sq(db).query(
    'SELECT id, confirmed FROM character_relationships WHERE id = :id AND deleted_at IS NULL',
    { replacements: { id }, ...SELECT(db) });
  if (!row) throw new SeedError('Relationship not found', 404);
  if (row.confirmed) throw new SeedError('It is confirmed already, so it is not a seed any more.', 409);
  await sq(db).query(
    `UPDATE character_relationships SET seed_state = :state,
        dismiss_reason = CASE WHEN :state IS NULL THEN NULL ELSE dismiss_reason END,
        dismiss_note = CASE WHEN :state IS NULL THEN NULL ELSE dismiss_note END,
        updated_at = NOW()
      WHERE id = :id AND deleted_at IS NULL AND confirmed = false`,
    { replacements: { id, state } });
  return { id };
}

/**
 * Dismiss a seed with Evoni's reason. "Too soon" is not a no: the seed stays,
 * put off for later (seed_state 'later'). Any other reason, or none, marks it
 * deleted with the reason, as Dismiss did (POST /:id/restore is its Undo).
 * Returns { later: true } or { dismissed: true }.
 */
async function dismissSeed(db, id, { reason, note } = {}) {
  if (!UUID_RE.test(String(id || ''))) throw new SeedError('Relationship not found', 404);
  const why = reason == null || reason === '' ? null : String(reason);
  if (why && !REASONS.includes(why)) throw new SeedError(`reason must be one of ${REASONS.join(', ')}`);
  const [row] = await sq(db).query(
    'SELECT id, confirmed FROM character_relationships WHERE id = :id AND deleted_at IS NULL',
    { replacements: { id }, ...SELECT(db) });
  if (!row) throw new SeedError('Relationship not found', 404);
  if (row.confirmed) throw new SeedError('Cannot dismiss a confirmed relationship. Use DELETE /:id instead.', 400);
  const replacements = { id, reason: why, note: text(note, 1000) };
  if (why === 'too_soon') {
    await sq(db).query(
      `UPDATE character_relationships SET seed_state = 'later', dismiss_reason = 'too_soon', dismiss_note = :note, updated_at = NOW()
        WHERE id = :id AND deleted_at IS NULL AND confirmed = false`, { replacements });
    return { later: true };
  }
  await sq(db).query(
    `UPDATE character_relationships SET deleted_at = NOW(), dismiss_reason = :reason, dismiss_note = :note, updated_at = NOW()
      WHERE id = :id AND deleted_at IS NULL AND confirmed = false`, { replacements });
  return { dismissed: true };
}

module.exports = {
  APP_TYPES, KINDS, SOURCES, REASONS, MODELS, SeedError,
  skipIndex, skipWhy, aimOf, seedPrompt, basisOf, whyOf, cleanSeeds,
  insertSeed, generateSeeds, createSeeds, confirmSeed, confirmMany, setSeedState, dismissSeed,
};

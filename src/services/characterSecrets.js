'use strict';

/**
 * A character's secrets and the revelation budget (Evoni, 2026-10-17, stage
 * B of the storytelling plan: "Give each story a revelation budget ...
 * Before writing, the system should decide what it is allowed to reveal").
 *
 * A secret is one thing the character keeps (character_secrets): what it
 * is, the part of the inner life it comes from, who in the story knows it,
 * where it stands with the audience, and what each layer may do with it:
 *
 *   permissions  { episode, short_story, chapter }, each
 *                hidden  no hint on the page
 *                hint    shown in what they do; nobody explains it (the default)
 *                reveal  this layer may let the audience learn it
 *   state        hidden | hinted | revealed: where the audience stands now,
 *                with state_where { note } saying where it happened
 *   status       candidate (suggested, not kept) | confirmed | retired
 *
 * The Character Story Brief (services/characterStoryBrief) reads the
 * confirmed ones through secretsFor; a storyteller scene uses the chapter's
 * permission.
 *
 *   listSecrets(sequelize, characterId)      { secrets, cast } for the Inner life
 *   secretsFor(sequelize, characterIds)      Map id -> confirmed secrets, for writers;
 *                                            an empty Map when the table is not there yet
 *   createSecret / updateSecret / deleteSecret
 *   suggestSecrets(sequelize, character)     one Sonnet call over their brief; saves
 *                                            up to five candidates
 *
 * Raw SQL; no model. The blind spot is never a source: it stays author
 * knowledge (the brief does not carry it).
 */

const { storyBrief } = require('./characterStoryBrief');

const MODELS = ['claude-sonnet-4-6'];
const LAYER_KEYS = ['episode', 'short_story', 'chapter'];
const PERMISSIONS = ['hidden', 'hint', 'reveal'];
const STATES = ['hidden', 'hinted', 'revealed'];
const STATUSES = ['candidate', 'confirmed', 'retired'];
const SOURCES = [
  'want_architecture', 'hidden_want', 'core_desire', 'core_fear', 'core_wound', 'wound', 'truth_persona', 'dilemma',
  'triggers', 'de_forbidden_joy', 'self_narrative', 'foreclosed_possibility', 'living_state', 'other',
];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_PERMISSIONS = { episode: 'hint', short_story: 'hint', chapter: 'hint' };

class SecretError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; this.name = 'SecretError'; }
}

const COLUMNS = `s.id, s.registry_character_id, s.text, s.source_field, s.known_by, s.state, s.state_where,
  s.permissions, s.status, s.created_at, s.updated_at,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id', k.id, 'name', COALESCE(k.selected_name, k.display_name)) ORDER BY k.display_name)
              FROM registry_characters k
             WHERE k.deleted_at IS NULL
               AND k.id::text IN (SELECT jsonb_array_elements_text(s.known_by))), '[]'::jsonb) AS known_by_people`;

const shape = (r) => ({
  id: r.id,
  character_id: r.registry_character_id,
  text: r.text,
  source_field: r.source_field,
  known_by: Array.isArray(r.known_by) ? r.known_by : [],
  known_by_people: Array.isArray(r.known_by_people) ? r.known_by_people : [],
  state: r.state,
  where: r.state_where?.note || null,
  permissions: { ...DEFAULT_PERMISSIONS, ...(r.permissions || {}) },
  status: r.status,
  created_at: r.created_at,
  updated_at: r.updated_at,
});

async function characterOf(sequelize, characterId) {
  if (!UUID_RE.test(String(characterId || ''))) throw new SecretError('id must be a character id (UUID)');
  const [[c]] = await sequelize.query(
    'SELECT id, registry_id FROM registry_characters WHERE id = :id AND deleted_at IS NULL', { replacements: { id: characterId } });
  if (!c) throw new SecretError('Character not found', 404);
  return c;
}

/** Their secrets, kept and suggested (retired ones left out), and the cast of their registry for Known to. */
async function listSecrets(sequelize, characterId) {
  const c = await characterOf(sequelize, characterId);
  const [rows] = await sequelize.query(
    `SELECT ${COLUMNS} FROM character_secrets s
      WHERE s.registry_character_id = :id AND s.deleted_at IS NULL AND s.status <> 'retired'
      ORDER BY s.status = 'candidate', s.created_at`, { replacements: { id: c.id } });
  const [cast] = await sequelize.query(
    `SELECT id, COALESCE(selected_name, display_name) AS name FROM registry_characters
      WHERE registry_id = :reg AND id <> :id AND deleted_at IS NULL ORDER BY COALESCE(selected_name, display_name)`,
    { replacements: { reg: c.registry_id, id: c.id } });
  return { secrets: rows.map(shape), cast };
}

/** Each character's confirmed secrets, by id; an empty Map with no ids or no table yet. */
async function secretsFor(sequelize, characterIds) {
  const ids = [...new Set((characterIds || []).filter((id) => UUID_RE.test(String(id || ''))))];
  const out = new Map();
  if (!ids.length) return out;
  try {
    const [rows] = await sequelize.query(
      `SELECT ${COLUMNS} FROM character_secrets s
        WHERE s.registry_character_id IN (:ids) AND s.deleted_at IS NULL AND s.status = 'confirmed'
        ORDER BY s.created_at`, { replacements: { ids } });
    for (const r of rows) {
      const list = out.get(r.registry_character_id) || [];
      list.push(shape(r));
      out.set(r.registry_character_id, list);
    }
  } catch (err) {
    // Before the migration has run the table is not there: the brief goes without secrets.
    console.error('[characterSecrets] could not read secrets:', err.message);
  }
  return out;
}

/** The fields a request may set, checked; a SecretError when one is wrong. */
async function normalize(sequelize, body, characterId, { partial = false } = {}) {
  const out = {};
  if (body.text !== undefined || !partial) {
    const t = typeof body.text === 'string' ? body.text.trim() : '';
    if (!t) throw new SecretError('Write the secret.');
    out.text = t.slice(0, 2000);
  }
  if (body.source_field !== undefined) {
    if (body.source_field !== null && !SOURCES.includes(body.source_field)) throw new SecretError('That is not a part of their inner life.');
    out.source_field = body.source_field;
  }
  if (body.known_by !== undefined) {
    if (!Array.isArray(body.known_by) || body.known_by.some((id) => !UUID_RE.test(String(id)))) throw new SecretError('Known to is a list of character ids.');
    const ids = [...new Set(body.known_by.filter((id) => id !== characterId))];
    if (ids.length) {
      const [found] = await sequelize.query(
        'SELECT id FROM registry_characters WHERE id IN (:ids) AND deleted_at IS NULL', { replacements: { ids } });
      if (found.length !== ids.length) throw new SecretError('Someone in Known to is not a character.');
    }
    out.known_by = ids;
  }
  if (body.permissions !== undefined) {
    const p = body.permissions || {};
    for (const [k, v] of Object.entries(p)) {
      if (!LAYER_KEYS.includes(k) || !PERMISSIONS.includes(v)) throw new SecretError('Each layer is hidden, hint or reveal.');
    }
    out.permissions = p;
  }
  if (body.state !== undefined) {
    if (!STATES.includes(body.state)) throw new SecretError('Where the audience stands is hidden, hinted or revealed.');
    out.state = body.state;
  }
  if (body.where !== undefined) {
    out.state_where = typeof body.where === 'string' && body.where.trim() ? { note: body.where.trim().slice(0, 300) } : null;
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) throw new SecretError('A secret is a candidate, kept, or retired.');
    out.status = body.status;
  }
  return out;
}

async function getSecret(sequelize, characterId, secretId) {
  if (!UUID_RE.test(String(secretId || ''))) throw new SecretError('secretId must be a UUID');
  const [[row]] = await sequelize.query(
    `SELECT ${COLUMNS} FROM character_secrets s WHERE s.id = :secretId AND s.registry_character_id = :characterId AND s.deleted_at IS NULL`,
    { replacements: { secretId, characterId } });
  if (!row) throw new SecretError('Secret not found', 404);
  return shape(row);
}

async function createSecret(sequelize, characterId, body = {}, { by = null } = {}) {
  const c = await characterOf(sequelize, characterId);
  const v = await normalize(sequelize, body, c.id);
  const permissions = { ...DEFAULT_PERMISSIONS, ...(v.permissions || {}) };
  const [[row]] = await sequelize.query(
    `INSERT INTO character_secrets (registry_character_id, text, source_field, known_by, state, state_where, permissions, status, created_by, created_at, updated_at)
     VALUES (:id, :text, :source, CAST(:known AS jsonb), :state, CAST(:where AS jsonb), CAST(:perm AS jsonb), :status, :by, NOW(), NOW())
     RETURNING id`,
    { replacements: {
      id: c.id, text: v.text, source: v.source_field || null, known: JSON.stringify(v.known_by || []), state: v.state || 'hidden',
      where: v.state_where ? JSON.stringify(v.state_where) : null, perm: JSON.stringify(permissions), status: v.status || 'confirmed', by,
    } });
  return getSecret(sequelize, c.id, row.id);
}

async function updateSecret(sequelize, characterId, secretId, body = {}) {
  const c = await characterOf(sequelize, characterId);
  const current = await getSecret(sequelize, c.id, secretId);
  const v = await normalize(sequelize, body, c.id, { partial: true });
  if (v.permissions) v.permissions = { ...current.permissions, ...v.permissions };
  const sets = [];
  const replacements = { secretId: current.id };
  for (const [col, val] of Object.entries(v)) {
    const json = ['known_by', 'permissions', 'state_where'].includes(col);
    sets.push(json ? `${col} = CAST(:${col} AS jsonb)` : `${col} = :${col}`);
    replacements[col] = json ? (val === null ? null : JSON.stringify(val)) : val;
  }
  if (sets.length) {
    await sequelize.query(`UPDATE character_secrets SET ${sets.join(', ')}, updated_at = NOW() WHERE id = :secretId`, { replacements });
  }
  return getSecret(sequelize, c.id, current.id);
}

async function deleteSecret(sequelize, characterId, secretId) {
  const c = await characterOf(sequelize, characterId);
  const current = await getSecret(sequelize, c.id, secretId);
  await sequelize.query('UPDATE character_secrets SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id', { replacements: { id: current.id } });
  return { id: current.id };
}

let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const same = (a, b) => a.toLowerCase().replace(/\W+/g, ' ').trim() === b.toLowerCase().replace(/\W+/g, ' ').trim();

/**
 * One AI call reads their brief and proposes up to five secrets they keep,
 * each from a part of their inner life; they are saved as candidates for
 * Evoni to keep or discard. A SecretError when there is nothing to read.
 */
async function suggestSecrets(sequelize, characterId, { by = null } = {}) {
  const c = await characterOf(sequelize, characterId);
  const [[character]] = await sequelize.query('SELECT * FROM registry_characters WHERE id = :id', { replacements: { id: c.id } });
  const brief = storyBrief(character, { layer: 'chapter' });
  if (!brief.lines.some((l) => l.startsWith('PRIVATE AUTHOR TRUTH'))) {
    throw new SecretError('There is nothing in their inner life yet to find a secret in.', 409);
  }
  const { secrets: existing } = await listSecrets(sequelize, c.id);
  const name = character.selected_name || character.display_name || 'this character';
  const prompt = `${name} is a character in a story world. Here is what the author knows about them:

${brief.text}

${existing.length ? `Secrets already written down:\n${existing.map((s) => `- ${s.text}`).join('\n')}\n\n` : ''}Name up to five secrets ${name} keeps: concrete things they hide from the people around them, that a story could hint at and one day reveal. Each one a single plain sentence about a fact or an act, not a feeling in general. Do not repeat the ones already written down.

Answer with JSON only:
{"secrets": [{"text": "the secret", "source_field": one of ${JSON.stringify(SOURCES)}}]}`;
  let message;
  for (const model of MODELS) {
    try {
      message = await getClient().messages.create({ model, max_tokens: 800, messages: [{ role: 'user', content: prompt }] });
      break;
    } catch (modelErr) {
      console.warn(`[characterSecrets] suggesting with ${model} failed:`, modelErr.message);
      if (model === MODELS[MODELS.length - 1]) throw modelErr;
    }
  }
  let list;
  try {
    const raw = (message?.content?.[0]?.text || '').trim();
    list = JSON.parse((raw.match(/\{[\s\S]*\}/) || [raw])[0]).secrets;
    if (!Array.isArray(list)) throw new Error('no secrets list');
  } catch (err) {
    console.error('[characterSecrets] the suggestion could not be read:', err.message);
    throw new SecretError('The suggestion came back in a form that could not be read. Try again.', 502);
  }
  const added = [];
  for (const s of list.slice(0, 5)) {
    const t = typeof s?.text === 'string' ? s.text.trim() : '';
    if (!t || [...existing, ...added].some((e) => same(e.text, t))) continue;
    added.push(await createSecret(sequelize, c.id, {
      text: t, source_field: SOURCES.includes(s.source_field) ? s.source_field : 'other', status: 'candidate',
    }, { by }));
  }
  return { added };
}

module.exports = {
  LAYER_KEYS, PERMISSIONS, STATES, STATUSES, SOURCES, DEFAULT_PERMISSIONS, SecretError,
  listSecrets, secretsFor, createSecret, updateSecret, deleteSecret, suggestSecrets,
};

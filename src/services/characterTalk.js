'use strict';

/**
 * Talk: Evoni talks with a character in Lala's world as Dr. Amara Sinclair,
 * their therapist at The Quiet Room (Evoni, 2026-10-18: "You become someone
 * they trust with their secrets. Not their creator. Not their producer. Not
 * Prime. Their therapist."). The character answers from their character
 * file (services/characterFile), in their world (the LalaVerse: nobody there
 * knows JustAWoman exists or that Lala was made); a brand representative
 * also from their brand and their authority.
 *
 * Confidentiality (her ruling: "therapy conversations must not secretly
 * become gossip, brand intelligence, or public story material"): sessions
 * live in character_conversations, which only this service reads. Nothing a
 * session says reaches The Pulse, the press, a drafter or a writer. What it
 * revealed becomes, on her review, only:
 *   inner      a change to their inner life (one of INNER_FIELDS), applied
 *              when she says so
 *   secret     a candidate secret (character_secrets, status candidate),
 *              kept or discarded on their Inner life tab
 *   insight    a Producer Insight: a private note for her, kept or dismissed
 *              here, never sent anywhere
 * and Dr. Sinclair's own session note, which is what she remembers next time.
 *
 *   canTalk(character, feedProfile)      true for a character in Lala's world
 *                                        who is not Dr. Sinclair
 *   listSessions(db, characterId)        their sessions, newest first
 *   getSession(db, sessionId)            one session
 *   say(db, { characterId, sessionId, text, by })  Dr. Sinclair's line and
 *                                        the character's answer, saved
 *   review(db, sessionId)                what the session revealed, saved on it
 *   act(db, { sessionId, itemId, action, by })  apply | send | keep | dismiss
 */

const MODELS = ['claude-sonnet-4-6'];
const COUNSELOR = 'dr_sinclair';
const COUNSELOR_KEY = 'amara_sinclair';
const INNER_FIELDS = Object.freeze(['core_desire', 'core_fear', 'core_wound', 'hidden_want', 'blind_spot', 'self_narrative']);
const MAX_TEXT = 2000;
const MAX_TURNS = 40;
const MAX_NOTES = 3;

let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

class TalkError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const text = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const asJson = (v, fallback) => {
  if (v == null) return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch (err) {
    console.error('[characterTalk] a stored value is not JSON:', err.message);
    return fallback;
  }
};
const extraOf = (c) => asJson(c?.extra_fields, {}) || {};

function isCounselor(character) {
  return character?.character_key === COUNSELOR_KEY || extraOf(character).classification === 'confidential_professional';
}

function canTalk(character, feedProfile = null) {
  if (!character || isCounselor(character)) return false;
  const { worldOf } = require('./characterGenerationService');
  return ['lalaverse', 'series-2'].includes(worldOf(character, feedProfile));
}

async function characterOf(db, characterId) {
  const character = await db.RegistryCharacter.findByPk(characterId);
  if (!character) throw new TalkError(404, 'Character not found');
  return character;
}

async function asSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    registry_character_id: row.registry_character_id,
    counselor: row.counselor,
    messages: asJson(row.messages, []) || [],
    review: asJson(row.review, null),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function listSessions(db, characterId) {
  const [rows] = await db.sequelize.query(
    `SELECT id, registry_character_id, counselor, messages, review, created_at, updated_at FROM character_conversations
      WHERE registry_character_id = :id AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 50`,
    { replacements: { id: characterId } });
  return Promise.all(rows.map(asSession));
}

async function getSession(db, sessionId) {
  const [[row]] = await db.sequelize.query(
    `SELECT id, registry_character_id, counselor, messages, review, created_at, updated_at FROM character_conversations
      WHERE id = :id AND deleted_at IS NULL`,
    { replacements: { id: sessionId } });
  if (!row) throw new TalkError(404, 'Session not found');
  return asSession(row);
}

/** Their brand and authority, for a brand representative ('' for anyone else). */
async function brandBlock(db, character) {
  const extra = extraOf(character);
  if (!extra.representative_of) return '';
  let brand = null;
  try {
    const [[row]] = await db.sequelize.query('SELECT * FROM lalaverse_brands WHERE slug = :slug AND deleted_at IS NULL LIMIT 1', { replacements: { slug: extra.representative_of } });
    brand = row || null;
  } catch (err) {
    console.error('[characterTalk] their brand could not be read:', err.message);
  }
  const p = asJson(brand?.personality, null);
  const a = extra.authority || {};
  const lines = [`THEIR WORK: ${extra.title || 'representative'} of ${brand?.name || extra.brand_name || extra.representative_of}.`];
  if (brand) lines.push(`The brand (its established identity, which they never change): ${[brand.category, brand.description, brand.niche].map(text).filter(Boolean).join(' ')}`);
  if (p?.beliefs) lines.push(`What the brand believes (the brand's position, not necessarily theirs): ${text(p.beliefs)}`);
  if (a.label) lines.push(`Their authority: ${a.label}. They can: ${(a.can || []).join('; ')}. Needs someone above them: ${(a.needs_approval || []).join('; ') || 'nothing'}. In therapy they talk about their work; they agree to nothing here.`);
  return `${lines.join('\n')}\n`;
}

async function sessionNotes(db, characterId, exceptId) {
  const [rows] = await db.sequelize.query(
    `SELECT review FROM character_conversations
      WHERE registry_character_id = :id AND deleted_at IS NULL AND id <> :except AND review IS NOT NULL
      ORDER BY updated_at DESC LIMIT :n`,
    { replacements: { id: characterId, except: exceptId || '00000000-0000-0000-0000-000000000000', n: MAX_NOTES } });
  return rows.map((r) => text(asJson(r.review, {})?.session_note)).filter(Boolean);
}

function buildTalkPrompt({ name, fileBlock, worldLine, brand, notes }) {
  return `You are ${name}, a character in the LalaVerse, in a private session with your therapist, Dr. Amara Sinclair, at The Quiet Room. Speak only as ${name}, in your own voice, in the first person.

${worldLine}
In the LalaVerse there is one social app, The Pulse. Never name a real-world app, and never name JustAWoman.

Dr. Sinclair: a licensed therapist with a private practice. Perceptive, direct when it matters, occasionally funny, hard to manipulate. You know she is a therapist and that prominent people see her; you know almost nothing about her personal life and do not expect to.

${fileBlock}
${brand}${notes.length ? `What you have talked about in earlier sessions (her notes):\n${notes.map((n) => `- ${n}`).join('\n')}\n` : ''}
How you talk in here:
- This room is confidential. You can say things you would never post. You still have your defenses: open up as far as this character would, at this point in their life, with this therapist.
- Stay inside what the character file says is true. Do not invent new events, people, deals or facts as if they happened; you may wonder, fear, want and imagine.
- Answer what she asked. A few sentences, like talk, not an essay. No stage directions.`;
}

function toMessages(history) {
  // Dr. Sinclair speaks as the user; the character as the assistant.
  return history.slice(-MAX_TURNS).map((m) => ({ role: m.from === COUNSELOR ? 'user' : 'assistant', content: m.text }));
}

async function ask(prompt, messages, maxTokens) {
  let message;
  for (const model of MODELS) {
    try {
      message = await getClient().messages.create({ model, max_tokens: maxTokens, system: prompt, messages });
      break;
    } catch (modelErr) {
      console.warn(`[characterTalk] ${model} failed:`, modelErr.message);
      if (model === MODELS[MODELS.length - 1]) throw modelErr;
    }
  }
  return (message?.content?.[0]?.text || '').trim();
}

async function say(db, { characterId, sessionId = null, text: said, by = null }) {
  const line = String(said || '').trim().slice(0, MAX_TEXT);
  if (!line) throw new TalkError(400, 'Say something first');
  const character = await characterOf(db, characterId);
  const { loadCharacterFile, characterFileBlock } = require('./characterFile');
  const file = await loadCharacterFile(db, { character });
  if (!canTalk(character, file.feedProfile)) throw new TalkError(400, 'Talk is for characters in Lala\'s world');

  let session = sessionId ? await getSession(db, sessionId) : null;
  if (session && session.registry_character_id !== character.id) throw new TalkError(400, 'That session is not theirs');
  const history = [...(session?.messages || []), { from: COUNSELOR, text: line, at: new Date().toISOString() }];

  const { worldLineFor } = require('./characterGenerationService');
  const name = character.selected_name || character.display_name;
  const prompt = buildTalkPrompt({
    name,
    fileBlock: characterFileBlock(file),
    worldLine: worldLineFor(character, file.feedProfile),
    brand: await brandBlock(db, character),
    notes: await sessionNotes(db, character.id, session?.id),
  });
  const reply = await ask(prompt, toMessages(history), 500);
  if (!reply) throw new TalkError(502, 'They did not answer; try again');
  history.push({ from: 'character', text: reply, at: new Date().toISOString() });

  if (session) {
    await db.sequelize.query('UPDATE character_conversations SET messages = CAST(:m AS jsonb), updated_at = NOW() WHERE id = :id',
      { replacements: { m: JSON.stringify(history), id: session.id } });
    return getSession(db, session.id);
  }
  const [[row]] = await db.sequelize.query(
    `INSERT INTO character_conversations (id, registry_character_id, counselor, messages, created_by, created_at, updated_at)
     VALUES (gen_random_uuid(), :cid, :counselor, CAST(:m AS jsonb), :by, NOW(), NOW()) RETURNING id`,
    { replacements: { cid: character.id, counselor: COUNSELOR, m: JSON.stringify(history), by } });
  session = await getSession(db, row.id);
  return session;
}

function buildReviewPrompt({ name, fileBlock, transcript }) {
  return `You are helping the author of the LalaVerse review a private therapy session between ${name} and Dr. Amara Sinclair. The session is confidential: nothing here is public, and nothing you suggest is published.

${fileBlock}
THE SESSION:
${transcript}

Return JSON only:
{
  "session_note": "Dr. Sinclair's private note: 1-3 sentences on what came up and where they are, as she would write it",
  "inner": [{ "field": "one of ${INNER_FIELDS.join(', ')}", "value": "the new text for that field, in the file's style", "why": "what in the session shows it" }],
  "secrets": [{ "text": "something they keep from others that this session showed", "why": "..." }],
  "insights": [{ "text": "a Producer Insight for the author only: an emotional truth or story possibility this session suggests", "why": "..." }]
}
Only what the session really showed and the file does not already say. Empty lists are fine. At most 3 of each.`;
}

const newId = () => require('crypto').randomUUID();

async function review(db, sessionId) {
  const session = await getSession(db, sessionId);
  if (!session.messages.length) throw new TalkError(400, 'Nothing has been said yet');
  const character = await characterOf(db, session.registry_character_id);
  const { loadCharacterFile, characterFileBlock } = require('./characterFile');
  const file = await loadCharacterFile(db, { character });
  const name = character.selected_name || character.display_name;
  const transcript = session.messages.map((m) => `${m.from === COUNSELOR ? 'Dr. Sinclair' : name}: ${m.text}`).join('\n');
  const raw = await ask(buildReviewPrompt({ name, fileBlock: characterFileBlock(file), transcript }), [{ role: 'user', content: 'Review the session.' }], 1200);
  let parsed = {};
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match ? match[0] : raw);
  } catch (err) {
    console.error('[characterTalk] the review was not JSON:', err.message);
    throw new TalkError(502, 'The review could not be read; try again');
  }
  const list = (v) => (Array.isArray(v) ? v.slice(0, 3) : []);
  const items = [
    ...list(parsed.inner).filter((i) => INNER_FIELDS.includes(i?.field) && text(i.value))
      .map((i) => ({ id: newId(), kind: 'inner', field: i.field, value: text(i.value), current: text(character[i.field]) || null, why: text(i.why), status: 'open' })),
    ...list(parsed.secrets).filter((i) => text(i?.text)).map((i) => ({ id: newId(), kind: 'secret', text: text(i.text), why: text(i.why), status: 'open' })),
    ...list(parsed.insights).filter((i) => text(i?.text)).map((i) => ({ id: newId(), kind: 'insight', text: text(i.text), why: text(i.why), status: 'open' })),
  ];
  const result = { session_note: text(parsed.session_note) || null, items, reviewed_at: new Date().toISOString() };
  await db.sequelize.query('UPDATE character_conversations SET review = CAST(:r AS jsonb), updated_at = NOW() WHERE id = :id',
    { replacements: { r: JSON.stringify(result), id: session.id } });
  return getSession(db, session.id);
}

const ACTIONS = Object.freeze({ inner: ['apply', 'dismiss'], secret: ['send', 'dismiss'], insight: ['keep', 'dismiss'] });

async function act(db, { sessionId, itemId, action, by = null }) {
  const session = await getSession(db, sessionId);
  const r = session.review;
  const item = r?.items?.find((i) => i.id === itemId);
  if (!item) throw new TalkError(404, 'Suggestion not found');
  if (item.status !== 'open') throw new TalkError(400, 'That suggestion was already decided');
  if (!(ACTIONS[item.kind] || []).includes(action)) throw new TalkError(400, `A ${item.kind} suggestion can be ${(ACTIONS[item.kind] || []).join(' or ')}`);

  if (action === 'apply') {
    const character = await characterOf(db, session.registry_character_id);
    await character.update({ [item.field]: item.value });
  } else if (action === 'send') {
    const created = await require('./characterSecrets').createSecret(db.sequelize, session.registry_character_id,
      { text: item.text, status: 'candidate' }, { by });
    item.secret_id = created?.id || null;
  }
  item.status = { apply: 'applied', send: 'sent', keep: 'kept', dismiss: 'dismissed' }[action];
  item.decided_at = new Date().toISOString();
  await db.sequelize.query('UPDATE character_conversations SET review = CAST(:r AS jsonb), updated_at = NOW() WHERE id = :id',
    { replacements: { r: JSON.stringify(r), id: session.id } });
  return getSession(db, session.id);
}

module.exports = {
  canTalk, isCounselor, listSessions, getSession, say, review, act, buildTalkPrompt, buildReviewPrompt, brandBlock,
  TalkError, COUNSELOR, COUNSELOR_KEY, INNER_FIELDS, ACTIONS,
};

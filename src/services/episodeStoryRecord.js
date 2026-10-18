'use strict';

/**
 * The Episode Story Record (Evoni, 2026-10-17, stage C of the storytelling
 * plan): after an episode, what happened, what each character knew and
 * learned, which secrets were hinted at or revealed, what changed
 * emotionally, and what is left open. "The short-story writer uses that
 * record to deepen the experience and create additional clues. The
 * chapter-book writer uses both."
 *
 * A record is drafted (one AI call over the episode's script, outcome,
 * cast, their kept secrets and the show's open threads) and counts only
 * once Evoni approves it: writers read approved records, and approving
 * moves each secret's audience state on (hidden -> hinted; -> revealed),
 * with the episode as where.
 *
 *   getRecord(sequelize, episodeId)      { record, cast, threads } for the page
 *   draftRecord(sequelize, episodeId)    drafts (or redrafts) it; saves a draft
 *   draftLater(sequelize, episodeId)     the same after completion, when there is
 *                                        none yet; never throws
 *   updateRecord(sequelize, episodeId, body)  edits; an approved record goes back to draft
 *   approveRecord(sequelize, episodeId, { by })
 *   recordBlock(sequelize, episodeId)    the approved record as prompt text; ''
 *   castOf / openThreads                 the episode's cast with their kept secrets, and
 *                                        the show's unresolved threads (also for services/storyCanon)
 *
 * Raw SQL (episode_story_records, migration 20261018050000); no model.
 */

const { episodeCast } = require('./storyGenerationService');
const { secretsFor } = require('./characterSecrets');
const { EPISODE_EVENT_ID_SQL } = require('../utils/episodeEventSql');

const MODELS = ['claude-sonnet-4-6'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SCRIPT_LIMIT = 9000;
const MAX = { what: 3000, field: 600, people: 12, secrets: 12, threads: 10 };

class RecordError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; this.name = 'RecordError'; }
}

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const parse = (v, fallback) => {
  if (v === null || v === undefined) return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch (err) {
    console.error('[episodeStoryRecord] unreadable JSON:', err.message);
    return fallback;
  }
};

async function episodeOf(sequelize, episodeId) {
  if (!UUID_RE.test(String(episodeId || ''))) throw new RecordError('episodeId must be a UUID');
  const [[episode]] = await sequelize.query(
    `SELECT id, show_id, episode_number, title, description, script_content, evaluation_json
       FROM episodes WHERE id = :episodeId AND deleted_at IS NULL`, { replacements: { episodeId } });
  if (!episode) throw new RecordError('Episode not found', 404);
  return episode;
}

const shape = (r) => (r ? {
  id: r.id, episode_id: r.episode_id, status: r.status, what_happened: r.what_happened || '',
  characters: r.characters || [], secrets: r.secrets || [], threads: r.threads || [],
  drafted_at: r.drafted_at, approved_by: r.approved_by, approved_at: r.approved_at, updated_at: r.updated_at,
} : null);

async function rowOf(sequelize, episodeId) {
  const [[row]] = await sequelize.query(
    'SELECT * FROM episode_story_records WHERE episode_id = :episodeId AND deleted_at IS NULL', { replacements: { episodeId } });
  return row || null;
}

/** Who was in it (the event's host and guests), each with their kept secrets. */
async function castOf(sequelize, episodeId) {
  const [[event]] = await sequelize.query(
    `SELECT id, name, host, venue_name, narrative_stakes, canon_consequences, source_profile_id
       FROM world_events WHERE id = ${EPISODE_EVENT_ID_SQL}`, { replacements: { episodeId } });
  const rows = (await episodeCast(sequelize, event)).filter((c) => c.char_id);
  const seen = new Set();
  const people = rows.filter((c) => (seen.has(c.char_id) ? false : seen.add(c.char_id)));
  const secrets = await secretsFor(sequelize, people.map((c) => c.char_id));
  return {
    event: event || null,
    cast: people.map((c) => ({
      id: c.char_id,
      name: c.char_name || c.creator_name || c.display_name || c.handle,
      secrets: (secrets.get(c.char_id) || []).map((s) => ({ id: s.id, text: s.text, state: s.state, known_by: s.known_by_people.map((p) => p.name) })),
    })),
  };
}

async function openThreads(sequelize, showId) {
  if (!showId) return [];
  try {
    const [rows] = await sequelize.query(
      `SELECT id, title, description FROM show_story_threads
        WHERE show_id = :showId AND deleted_at IS NULL AND status <> 'closed' ORDER BY created_at`, { replacements: { showId } });
    return rows;
  } catch (err) {
    console.error('[episodeStoryRecord] open threads could not be read:', err.message);
    return [];
  }
}

/** The record (or null), the cast with their secrets, and the show's open threads. */
async function getRecord(sequelize, episodeId) {
  const episode = await episodeOf(sequelize, episodeId);
  const { cast } = await castOf(sequelize, episode.id);
  return { record: shape(await rowOf(sequelize, episode.id)), cast, threads: await openThreads(sequelize, episode.show_id) };
}

/** A record's fields from a body, kept to the cast, their secrets and the threads. */
function clean(body, { cast, threads }) {
  const people = new Map(cast.map((c) => [c.id, c]));
  const secrets = new Map(cast.flatMap((c) => c.secrets.map((s) => [s.id, { ...s, character_id: c.id }])));
  const threadIds = new Set(threads.map((t) => t.id));
  const out = {};
  if (body.what_happened !== undefined) out.what_happened = str(body.what_happened, MAX.what);
  if (body.characters !== undefined) {
    if (!Array.isArray(body.characters)) throw new RecordError('characters is a list.');
    out.characters = body.characters.filter((c) => people.has(c?.character_id)).slice(0, MAX.people).map((c) => ({
      character_id: c.character_id, name: people.get(c.character_id).name,
      knew: str(c.knew, MAX.field), learned: str(c.learned, MAX.field), changed: str(c.changed, MAX.field),
    }));
  }
  if (body.secrets !== undefined) {
    if (!Array.isArray(body.secrets)) throw new RecordError('secrets is a list.');
    const seen = new Set();
    out.secrets = body.secrets.filter((s) => secrets.has(s?.secret_id) && ['hinted', 'revealed'].includes(s.what) && !seen.has(s.secret_id) && seen.add(s.secret_id))
      .slice(0, MAX.secrets).map((s) => {
        const known = secrets.get(s.secret_id);
        return { secret_id: s.secret_id, character_id: known.character_id, text: known.text, what: s.what, how: str(s.how, MAX.field) };
      });
  }
  if (body.threads !== undefined) {
    if (!Array.isArray(body.threads)) throw new RecordError('threads is a list.');
    out.threads = body.threads.map((t) => ({
      thread_id: threadIds.has(t?.thread_id) ? t.thread_id : null, title: str(t?.title, 200), note: str(t?.note, MAX.field),
    })).filter((t) => t.title).slice(0, MAX.threads);
  }
  return out;
}

async function save(sequelize, episode, fields, { status, drafted = false }) {
  const existing = await rowOf(sequelize, episode.id);
  const json = (v) => JSON.stringify(v || []);
  if (!existing) {
    await sequelize.query(
      `INSERT INTO episode_story_records (episode_id, show_id, status, what_happened, characters, secrets, threads, drafted_at, created_at, updated_at)
       VALUES (:episodeId, :showId, :status, :what, CAST(:characters AS jsonb), CAST(:secrets AS jsonb), CAST(:threads AS jsonb), ${drafted ? 'NOW()' : 'NULL'}, NOW(), NOW())`,
      { replacements: {
        episodeId: episode.id, showId: episode.show_id || null, status, what: fields.what_happened || null,
        characters: json(fields.characters), secrets: json(fields.secrets), threads: json(fields.threads),
      } });
  } else {
    const sets = ['status = :status', 'updated_at = NOW()'];
    const replacements = { id: existing.id, status };
    if (drafted) sets.push('drafted_at = NOW()', 'approved_by = NULL', 'approved_at = NULL');
    if (fields.what_happened !== undefined) { sets.push('what_happened = :what'); replacements.what = fields.what_happened || null; }
    for (const col of ['characters', 'secrets', 'threads']) {
      if (fields[col] !== undefined) { sets.push(`${col} = CAST(:${col} AS jsonb)`); replacements[col] = json(fields[col]); }
    }
    await sequelize.query(`UPDATE episode_story_records SET ${sets.join(', ')} WHERE id = :id`, { replacements });
  }
  return shape(await rowOf(sequelize, episode.id));
}

let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

function draftPrompt({ episode, event, cast, threads }) {
  const evaluation = parse(episode.evaluation_json, null);
  const people = cast.map((c) => {
    const secrets = c.secrets.length
      ? c.secrets.map((s) => `    - [${s.id}] ${s.text} (the audience: ${s.state}; known to: ${s.known_by.join(', ') || 'no one else'})`).join('\n')
      : '    (no kept secrets)';
    return `- [${c.id}] ${c.name}\n  Secrets:\n${secrets}`;
  }).join('\n') || '(no characters are linked to this episode)';
  const open = threads.length ? threads.map((t) => `- [${t.id}] ${t.title}${t.description ? `: ${String(t.description).slice(0, 200)}` : ''}`).join('\n') : '(none)';
  const script = String(episode.script_content || '').trim();
  return `You keep the story record for "Styling Adventures with Lala". Read this episode and record what the audience saw. Record only what is on the page: do not invent events, and do not reveal a secret the script only hints at.

EPISODE ${episode.episode_number ?? '?'}: "${episode.title || 'Untitled'}"${episode.description ? `\n${String(episode.description).slice(0, 1000)}` : ''}
${event ? `EVENT: ${event.name || ''}${event.venue_name ? ` at ${event.venue_name}` : ''}${event.narrative_stakes ? `\nSTAKES: ${event.narrative_stakes}` : ''}` : ''}
${evaluation ? `OUTCOME: ${String(evaluation.tier_final || '').toUpperCase()} (${evaluation.score ?? '?'}/100) ${evaluation.narrative_lines?.short || ''}` : ''}

THE PEOPLE IN IT, WITH THE SECRETS THEY KEEP:
${people}

THE SHOW'S OPEN THREADS:
${open}

THE SCRIPT:
${script ? script.slice(0, SCRIPT_LIMIT) : '(no script: work from the outline above)'}

Answer with JSON only:
{
  "what_happened": "one paragraph: what happened in this episode, as the audience saw it",
  "characters": [{"character_id": "an id above", "knew": "what they knew going in that mattered here", "learned": "what they found out here, or empty", "changed": "how they changed emotionally, or empty"}],
  "secrets": [{"secret_id": "an id above", "what": "hinted or revealed", "how": "the moment on the page that hints at or reveals it"}],
  "threads": [{"thread_id": "an open thread's id above, or null for a new one", "title": "the question left open", "note": "where it stands after this episode"}]
}
List a secret only when the script shows it; "revealed" only when the audience now knows it.`;
}

/** Drafts the record from the episode; saves it as a draft (a redraft replaces an earlier one). */
async function draftRecord(sequelize, episodeId) {
  const episode = await episodeOf(sequelize, episodeId);
  const { event, cast } = await castOf(sequelize, episode.id);
  const threads = await openThreads(sequelize, episode.show_id);
  if (!String(episode.script_content || '').trim() && !episode.description) {
    throw new RecordError('This episode has no script or description yet to record.', 409);
  }
  let message;
  for (const model of MODELS) {
    try {
      message = await getClient().messages.create({ model, max_tokens: 2000, messages: [{ role: 'user', content: draftPrompt({ episode, event, cast, threads }) }] });
      break;
    } catch (modelErr) {
      console.warn(`[episodeStoryRecord] drafting with ${model} failed:`, modelErr.message);
      if (model === MODELS[MODELS.length - 1]) throw modelErr;
    }
  }
  let parsed;
  try {
    const raw = (message?.content?.[0]?.text || '').trim();
    parsed = JSON.parse((raw.match(/\{[\s\S]*\}/) || [raw])[0]);
  } catch (err) {
    console.error('[episodeStoryRecord] the draft could not be read:', err.message);
    throw new RecordError('The draft came back in a form that could not be read. Try again.', 502);
  }
  const fields = clean({
    what_happened: parsed.what_happened, characters: parsed.characters || [], secrets: parsed.secrets || [], threads: parsed.threads || [],
  }, { cast, threads });
  return { record: await save(sequelize, episode, fields, { status: 'draft', drafted: true }), cast, threads };
}

/** After completion: drafts the record when the episode has none. Never throws. */
async function draftLater(sequelize, episodeId) {
  try {
    if (await rowOf(sequelize, episodeId)) return null;
    return await draftRecord(sequelize, episodeId);
  } catch (err) {
    console.error('[episodeStoryRecord] drafting after completion failed (non-blocking):', err.message);
    return null;
  }
}

/** Evoni's edits. An approved record goes back to draft until she approves it again. */
async function updateRecord(sequelize, episodeId, body = {}) {
  const episode = await episodeOf(sequelize, episodeId);
  const { cast } = await castOf(sequelize, episode.id);
  const threads = await openThreads(sequelize, episode.show_id);
  const fields = clean(body, { cast, threads });
  return { record: await save(sequelize, episode, fields, { status: 'draft' }), cast, threads };
}

/** It counts: writers read it, and each secret it names moves on with the audience. */
async function approveRecord(sequelize, episodeId, { by = null } = {}) {
  const episode = await episodeOf(sequelize, episodeId);
  const row = await rowOf(sequelize, episode.id);
  if (!row) throw new RecordError('There is no record to approve yet. Draft it first.', 409);
  if (!String(row.what_happened || '').trim()) throw new RecordError('Say what happened before approving it.');
  const where = `Episode ${episode.episode_number ?? ''}${episode.title ? `: ${episode.title}` : ''}`.trim();
  await sequelize.transaction(async (transaction) => {
    for (const s of row.secrets || []) {
      // Revealed wins; a hint never takes back a reveal.
      const allowed = s.what === 'revealed' ? "('hidden', 'hinted')" : "('hidden')";
      await sequelize.query(
        `UPDATE character_secrets SET state = :state, state_where = CAST(:where AS jsonb), updated_at = NOW()
          WHERE id = :id AND deleted_at IS NULL AND state IN ${allowed}`,
        { replacements: { id: s.secret_id, state: s.what, where: JSON.stringify({ note: where, episode_id: episode.id }) }, transaction });
    }
    await sequelize.query(
      `UPDATE episode_story_records SET status = 'approved', approved_by = :by, approved_at = NOW(), updated_at = NOW() WHERE id = :id`,
      { replacements: { id: row.id, by }, transaction });
  });
  return getRecord(sequelize, episode.id);
}

/** The approved record as prompt text for the short story and chapter writers; '' when none. */
async function recordBlock(sequelize, episodeId) {
  let row;
  try {
    [[row]] = await sequelize.query(
      `SELECT what_happened, characters, secrets, threads FROM episode_story_records
        WHERE episode_id = :episodeId AND deleted_at IS NULL AND status = 'approved'`, { replacements: { episodeId } });
  } catch (err) {
    // Before the migration has run the table is not there: writers go without it.
    console.error('[episodeStoryRecord] the record could not be read:', err.message);
    return '';
  }
  if (!row) return '';
  const lines = ['THE EPISODE STORY RECORD (approved; what the audience saw. Stay consistent with it; go beneath it, never against it):'];
  if (row.what_happened) lines.push(`What happened: ${row.what_happened}`);
  for (const c of row.characters || []) {
    const parts = [c.knew && `knew ${c.knew}`, c.learned && `learned ${c.learned}`, c.changed && `changed: ${c.changed}`].filter(Boolean);
    if (parts.length) lines.push(`- ${c.name}: ${parts.join('; ')}`);
  }
  if ((row.secrets || []).length) {
    lines.push('Secrets the audience has seen so far in this episode:');
    for (const s of row.secrets) lines.push(`- ${s.what === 'revealed' ? 'Revealed' : 'Hinted'}: ${s.text}${s.how ? ` (${s.how})` : ''}`);
  }
  if ((row.threads || []).length) {
    lines.push('Left open:');
    for (const t of row.threads) lines.push(`- ${t.title}${t.note ? `: ${t.note}` : ''}`);
  }
  return lines.join('\n');
}

module.exports = { RecordError, getRecord, draftRecord, draftLater, updateRecord, approveRecord, recordBlock, draftPrompt, castOf, openThreads };

'use strict';

/**
 * Canon approval for short stories (Evoni, 2026-10-17, stage D of the
 * storytelling plan: "the short story should not invent a major new
 * canonical event that contradicts the episode or future chapters. New
 * revelations should be proposed for canon approval").
 *
 * After a short story is written, one AI call reads it against the
 * episode's approved story record (services/episodeStoryRecord), the cast's
 * kept secrets with what a short story may do with each, and the show's
 * unresolved threads. What the story adds becomes proposals
 * (story_canon_proposals): secrets it hints at or reveals (marked over
 * budget when it goes past the secret's short-story permission), new facts,
 * threads, and contradictions with the record (flags). Nothing is canon
 * until Evoni accepts it:
 *   secret  its audience state moves on (hidden -> hinted, or -> revealed),
 *           with the story as where
 *   thread  a new one opens; an existing one is marked advanced. Its thread
 *           proposals also wait in the show's threads list (services/
 *           threadInbox, 2026-10-26), checked there, for Keep, Merge into…
 *           or Drop; those go through acceptProposal and dismissProposal.
 *   fact    canon the chapter writer may build on; a dismissed fact is not
 *
 *   listCanon(sequelize, episodeId)          the episode's stories with their proposals
 *   reviewStory(sequelize, storyId)          reads the story; replaces its pending proposals
 *   reviewLater(sequelize, storyId)          the same after generation; never throws
 *   acceptProposal / dismissProposal(sequelize, id, { by })
 *   canonBlock(sequelize, episodeId)         decided facts as prompt text; ''
 *
 * Raw SQL (story_canon_proposals, migration 20261018060000); no model.
 */

const { castOf, openThreads, recordBlock } = require('./episodeStoryRecord');
const { secretsFor } = require('./characterSecrets');

const MODELS = ['claude-sonnet-4-6'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORY_LIMIT = 14000;
const KINDS = ['secret', 'fact', 'thread', 'contradiction'];
const MAX = { per_kind: 8, text: 600 };
// Where the audience may already be, per secret state; a proposal that moves nothing is dropped.
const MOVES = { hinted: ['hidden'], revealed: ['hidden', 'hinted'] };

class CanonError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; this.name = 'CanonError'; }
}

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

async function storyOf(sequelize, storyId) {
  if (!UUID_RE.test(String(storyId || ''))) throw new CanonError('storyId must be a UUID');
  const [[story]] = await sequelize.query(
    `SELECT s.id, s.episode_id, s.show_id, s.title, s.subtitle, s.format, s.content, s.metadata, s.created_at,
            e.episode_number, e.title AS episode_title, e.show_id AS episode_show_id
       FROM stories s LEFT JOIN episodes e ON e.id = s.episode_id AND e.deleted_at IS NULL
      WHERE s.id = :storyId AND s.deleted_at IS NULL`, { replacements: { storyId } });
  if (!story) throw new CanonError('Story not found', 404);
  if (!story.episode_id) throw new CanonError('This story is not tied to an episode.', 409);
  return story;
}

const shape = (r) => ({
  id: r.id, story_id: r.story_id, kind: r.kind, status: r.status, decided_by: r.decided_by, decided_at: r.decided_at, ...r.payload,
});

/** The episode's stories (newest first), each with its proposals, pending first, and whether it has been read. */
async function listCanon(sequelize, episodeId) {
  if (!UUID_RE.test(String(episodeId || ''))) throw new CanonError('episodeId must be a UUID');
  const [stories] = await sequelize.query(
    `SELECT id, title, subtitle, format, word_count, status, created_at, metadata->>'canon_reviewed_at' AS reviewed_at
       FROM stories WHERE episode_id = :episodeId AND deleted_at IS NULL AND format = 'short_story'
      ORDER BY created_at DESC`, { replacements: { episodeId } });
  const [rows] = stories.length ? await sequelize.query(
    `SELECT * FROM story_canon_proposals WHERE story_id IN (:ids) AND deleted_at IS NULL
      ORDER BY (status = 'pending') DESC, created_at`, { replacements: { ids: stories.map((s) => s.id) } }) : [[]];
  return {
    stories: stories.map((s) => ({ ...s, proposals: rows.filter((r) => r.story_id === s.id).map(shape) })),
    pending: rows.filter((r) => r.status === 'pending' && r.kind !== 'contradiction').length,
  };
}

let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

function reviewPrompt({ story, record, cast, secrets, threads }) {
  const people = cast.map((c) => {
    const list = (secrets.get(c.id) || []).map((s) =>
      `    - [${s.id}] ${s.text} (the audience: ${s.state}; a short story may: ${s.permissions.short_story})`).join('\n') || '    (no kept secrets)';
    return `- ${c.name}\n${list}`;
  }).join('\n') || '(no characters are linked to this episode)';
  const open = threads.length ? threads.map((t) => `- [${t.id}] ${t.title}`).join('\n') : '(none)';
  return `You keep canon for "Styling Adventures with Lala". A short story was written from Episode ${story.episode_number ?? '?'}: "${story.episode_title || story.title || ''}". The short story may go beneath the episode; it may not change what the episode showed, and anything new it adds is only proposed until the author accepts it.

${record || 'THE EPISODE STORY RECORD: none approved yet. Judge against the story alone; list no contradictions.'}

THE PEOPLE, WITH THE SECRETS THEY KEEP:
${people}

THE SHOW'S OPEN THREADS:
${open}

THE SHORT STORY:
${String(story.content || '').slice(0, STORY_LIMIT)}

Answer with JSON only:
{
  "secrets": [{"secret_id": "an id above", "what": "hinted or revealed", "how": "the moment in the story"}],
  "facts": [{"text": "a new event or fact the story establishes that the episode did not show"}],
  "threads": [{"thread_id": "an open thread's id above, or null for a new question", "title": "the question", "note": "what the story adds to it"}],
  "contradictions": [{"text": "where the story goes against the record, quoting both"}]
}
List only what the story itself shows. Facts are concrete events or facts, not mood or interpretation. Keep each list short.`;
}

/** Reads the story and replaces its pending proposals with what it adds now. */
async function reviewStory(sequelize, storyId) {
  const story = await storyOf(sequelize, storyId);
  if (!String(story.content || '').trim()) throw new CanonError('The story has no text yet.', 409);
  const { cast } = await castOf(sequelize, story.episode_id);
  const secrets = await secretsFor(sequelize, cast.map((c) => c.id));
  const showId = story.show_id || story.episode_show_id;
  const threads = await openThreads(sequelize, showId);
  const record = await recordBlock(sequelize, story.episode_id);

  let message;
  for (const model of MODELS) {
    try {
      message = await getClient().messages.create({ model, max_tokens: 2000, messages: [{ role: 'user', content: reviewPrompt({ story, record, cast, secrets, threads }) }] });
      break;
    } catch (modelErr) {
      console.warn(`[storyCanon] reviewing with ${model} failed:`, modelErr.message);
      if (model === MODELS[MODELS.length - 1]) throw modelErr;
    }
  }
  let parsed;
  try {
    const raw = (message?.content?.[0]?.text || '').trim();
    parsed = JSON.parse((raw.match(/\{[\s\S]*\}/) || [raw])[0]);
  } catch (err) {
    console.error('[storyCanon] the review could not be read:', err.message);
    throw new CanonError('The review came back in a form that could not be read. Try again.', 502);
  }

  const known = new Map([...secrets.entries()].flatMap(([characterId, list]) => list.map((s) => [s.id, { ...s, character_id: characterId }])));
  const threadIds = new Set(threads.map((t) => t.id));
  const list = (v) => (Array.isArray(v) ? v.slice(0, MAX.per_kind) : []);
  const seen = new Set();
  const proposals = [
    ...list(parsed.secrets).filter((s) => known.has(s?.secret_id) && MOVES[s.what] && !seen.has(s.secret_id) && seen.add(s.secret_id))
      .filter((s) => MOVES[s.what].includes(known.get(s.secret_id).state))
      .map((s) => {
        const k = known.get(s.secret_id);
        const allowed = k.permissions.short_story;
        return { kind: 'secret', payload: {
          secret_id: k.id, character_id: k.character_id, text: k.text, what: s.what, how: str(s.how, MAX.text),
          permission: allowed, over_budget: s.what === 'revealed' ? allowed !== 'reveal' : allowed === 'hidden',
        } };
      }),
    ...list(parsed.facts).map((f) => str(f?.text, MAX.text)).filter(Boolean).map((text) => ({ kind: 'fact', payload: { text } })),
    ...list(parsed.threads).map((t) => ({ thread_id: threadIds.has(t?.thread_id) ? t.thread_id : null, title: str(t?.title, 200), note: str(t?.note, MAX.text) }))
      .filter((t) => t.title).map((payload) => ({ kind: 'thread', payload })),
    ...(record ? list(parsed.contradictions) : []).map((c) => str(c?.text, MAX.text)).filter(Boolean).map((text) => ({ kind: 'contradiction', payload: { text } })),
  ];

  await sequelize.transaction(async (transaction) => {
    await sequelize.query(
      "UPDATE story_canon_proposals SET deleted_at = NOW(), updated_at = NOW() WHERE story_id = :storyId AND status = 'pending' AND deleted_at IS NULL",
      { replacements: { storyId: story.id }, transaction });
    for (const p of proposals) {
      await sequelize.query(
        `INSERT INTO story_canon_proposals (story_id, episode_id, show_id, kind, payload, status, created_at, updated_at)
         VALUES (:storyId, :episodeId, :showId, :kind, CAST(:payload AS jsonb), 'pending', NOW(), NOW())`,
        { replacements: { storyId: story.id, episodeId: story.episode_id, showId: showId || null, kind: p.kind, payload: JSON.stringify(p.payload) }, transaction });
    }
    await sequelize.query(
      `UPDATE stories SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{canon_reviewed_at}', to_jsonb(NOW()::text)), updated_at = NOW()
        WHERE id = :storyId`, { replacements: { storyId: story.id }, transaction });
  });
  // Its thread proposals wait in the show's threads list; the check reads them there (never awaited).
  if (showId && proposals.some((p) => p.kind === 'thread' && !p.payload.thread_id)) require('./threadInbox').checkWaitingLater(sequelize, showId);
  return listCanon(sequelize, story.episode_id);
}

/** After a short story is generated: reads it. Never throws. */
async function reviewLater(sequelize, storyId) {
  try {
    return await reviewStory(sequelize, storyId);
  } catch (err) {
    console.error('[storyCanon] reviewing the new story failed (non-blocking):', err.message);
    return null;
  }
}

/** Claims a pending proposal for a decision, in the transaction; a CanonError when it is gone or decided. */
async function claim(sequelize, proposalId, status, by, transaction) {
  if (!UUID_RE.test(String(proposalId || ''))) throw new CanonError('proposalId must be a UUID');
  const [rows] = await sequelize.query(
    `UPDATE story_canon_proposals SET status = :status, decided_by = :by, decided_at = NOW(), updated_at = NOW()
      WHERE id = :proposalId AND status = 'pending' AND deleted_at IS NULL
      ${status === 'accepted' ? "AND kind <> 'contradiction'" : ''}
      RETURNING *`, { replacements: { proposalId, status, by }, transaction });
  if (rows[0]) return rows[0];
  const [[row]] = await sequelize.query('SELECT kind, status FROM story_canon_proposals WHERE id = :proposalId AND deleted_at IS NULL',
    { replacements: { proposalId }, transaction });
  if (!row) throw new CanonError('Proposal not found', 404);
  if (row.kind === 'contradiction' && row.status === 'pending') throw new CanonError('A contradiction can only be dismissed: change the story or the record instead.', 409);
  throw new CanonError('That proposal has already been decided.', 409);
}

/** It becomes canon: a secret moves on, a thread opens or advances, a fact holds. */
async function acceptProposal(sequelize, proposalId, { by = null } = {}) {
  const decided = await sequelize.transaction(async (transaction) => {
    const p = await claim(sequelize, proposalId, 'accepted', by, transaction);
    const payload = p.payload || {};
    if (p.kind === 'secret') {
      const [[story]] = await sequelize.query('SELECT title, subtitle FROM stories WHERE id = :id', { replacements: { id: p.story_id }, transaction });
      const where = `Short story: ${story?.title || 'untitled'}`;
      await sequelize.query(
        `UPDATE character_secrets SET state = :state, state_where = CAST(:where AS jsonb), updated_at = NOW()
          WHERE id = :id AND deleted_at IS NULL AND state IN (:from)`,
        { replacements: { id: payload.secret_id, state: payload.what, from: MOVES[payload.what] || ['hidden'],
          where: JSON.stringify({ note: where, story_id: p.story_id, episode_id: p.episode_id }) }, transaction });
    } else if (p.kind === 'thread') {
      if (payload.thread_id) {
        await sequelize.query(
          `UPDATE show_story_threads SET status = 'advanced', last_advanced_episode_id = :episodeId, last_advanced_at = NOW(), updated_at = NOW()
            WHERE id = :id AND deleted_at IS NULL AND status <> 'closed'`,
          { replacements: { id: payload.thread_id, episodeId: p.episode_id }, transaction });
      } else if (p.show_id) {
        await sequelize.query(
          `INSERT INTO show_story_threads (id, show_id, title, description, status, source, opened_episode_id, created_at, updated_at)
           VALUES (gen_random_uuid(), :showId, :title, :description, 'open', 'evoni', :episodeId, NOW(), NOW())`,
          { replacements: { showId: p.show_id, title: payload.title, description: payload.note || null, episodeId: p.episode_id }, transaction });
      }
    }
    return p;
  });
  return listCanon(sequelize, decided.episode_id);
}

async function dismissProposal(sequelize, proposalId, { by = null } = {}) {
  const p = await sequelize.transaction((transaction) => claim(sequelize, proposalId, 'dismissed', by, transaction));
  return listCanon(sequelize, p.episode_id);
}

/** What the episode's short stories added that Evoni decided on, as prompt text for the chapter writer; ''. */
async function canonBlock(sequelize, episodeId) {
  let rows;
  try {
    [rows] = await sequelize.query(
      `SELECT kind, status, payload FROM story_canon_proposals
        WHERE episode_id = :episodeId AND deleted_at IS NULL AND status IN ('accepted', 'dismissed') AND kind IN ('fact', 'secret')
        ORDER BY decided_at`, { replacements: { episodeId } });
  } catch (err) {
    // Before the migration has run the table is not there: the writer goes without it.
    console.error('[storyCanon] decided proposals could not be read:', err.message);
    return '';
  }
  const line = (r) => (r.kind === 'secret' ? `- ${r.payload.what === 'revealed' ? 'Revealed' : 'Hinted'}: ${r.payload.text}` : `- ${r.payload.text}`);
  const accepted = rows.filter((r) => r.status === 'accepted');
  const dismissed = rows.filter((r) => r.status === 'dismissed');
  const out = [];
  if (accepted.length) out.push('CANON THE SHORT STORY ADDED (approved; build on it):', ...accepted.map(line));
  if (dismissed.length) out.push('NOT CANON (the short story said it, but it was not approved; do not build on it):', ...dismissed.map(line));
  return out.join('\n');
}

module.exports = { CanonError, KINDS, listCanon, reviewStory, reviewLater, acceptProposal, dismissProposal, canonBlock, reviewPrompt };

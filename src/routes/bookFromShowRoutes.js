'use strict';

/**
 * The book follows the show (Evoni, 2026-10-15; docs/CANON.md "The books are
 * written from the show"):
 *   the episode      what the viewer sees; beat 11 (Event Outcome) plays an
 *                    animated piece of the short story
 *   the short story  the event in full (stories, format 'short_story')
 *   the chapter      everything the viewer does not see, in JustAWoman's
 *                    point of view: her life in her world, and all she
 *                    imagines happening in Lala's world beyond the events
 *
 *   GET  /api/v1/book-from-show/books/:bookId/ledger?show_id=
 *        each episode of the show: its short story, its beat 11 excerpt, and
 *        the book's chapter for it (written or not)
 *   GET  /api/v1/book-from-show/chapters/:id/episode
 *   PUT  /api/v1/book-from-show/chapters/:id/episode        { episode_id | null }
 *   POST /api/v1/book-from-show/chapters/:id/write-from-episode
 *        a draft of the chapter from its episode, its approved story record,
 *        its short story and what Evoni accepted (or dismissed) of what the
 *        story added; a preview, nothing is saved
 *   POST /api/v1/book-from-show/chapters/:id/check-against-story
 *        where the chapter's draft contradicts the short story
 *   POST /api/v1/book-from-show/books/:bookId/plan         { count, show_id }
 *        plans the next chapters from the episodes that owe one (a
 *        preview: title, goal, where she starts and ends, notes)
 *   POST /api/v1/book-from-show/books/:bookId/plan/apply   { items, show_id }
 *        writes it: a new chapter tied to each episode with none; an
 *        existing chapter only gets its empty plan fields filled
 *   GET  /api/v1/book-from-show/shows/:showId/transfer
 *   PUT  /api/v1/book-from-show/shows/:showId/transfer      { episode_id | null }
 *        the episode in which JustAWoman's consciousness transfers into Lala
 *        (shows.metadata.consciousness_transfer; Evoni, 2026-10-15: "not
 *        decided yet"). The chapter writer places the Lala bleed in the
 *        first chapter after it, and writes none before it is set.
 *   GET  /api/v1/book-from-show/episodes/:episodeId/record   the Episode Story Record
 *        (stage C; services/episodeStoryRecord): what happened, what each
 *        character knew and learned, the secrets hinted or revealed, what is
 *        left open; with the cast, their kept secrets and the open threads
 *   POST /api/v1/book-from-show/episodes/:episodeId/record/draft  one AI call
 *        drafts it from the episode (a redraft replaces it, as a draft)
 *   PUT  /api/v1/book-from-show/episodes/:episodeId/record   edits; an approved
 *        record goes back to draft
 *   POST /api/v1/book-from-show/episodes/:episodeId/record/approve  it counts:
 *        the short story and chapter writers read it, and its secrets move on
 *        with the audience
 *   GET  /api/v1/book-from-show/episodes/:episodeId/canon    canon approval for its
 *        short stories (stage D; services/storyCanon): each story with what
 *        it adds, proposed: secrets hinted or revealed, new facts, threads,
 *        and contradictions with the record (flags)
 *   POST /api/v1/book-from-show/stories/:storyId/canon/review  one AI call reads
 *        the story again; its pending proposals are replaced
 *   POST /api/v1/book-from-show/canon/:proposalId/accept       it becomes canon: a
 *        secret moves on, a thread opens or advances, a fact holds
 *   POST /api/v1/book-from-show/canon/:proposalId/dismiss
 *   GET  /api/v1/book-from-show/episodes/:episodeId/beat11  the episode's beat 11
 *        piece, for the Scene Planner's beat 11
 *   GET  /api/v1/book-from-show/stories/:storyId/beat11-excerpt
 *   POST /api/v1/book-from-show/stories/:storyId/beat11-excerpt
 *        cuts the short story's beat 11 piece and saves it
 *        (stories.metadata.beat11_excerpt)
 *   PUT  /api/v1/book-from-show/stories/:storyId/beat11-excerpt   { text }
 *
 * storyteller_chapters.episode_id (migration 20261015200000) is read and
 * written here with SQL, not through the model, so the model's reads do not
 * depend on the column.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Anthropic = require('@anthropic-ai/sdk');
const { requireAuth } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');
const { EPISODE_EVENT_ID_SQL } = require('../utils/episodeEventSql');
const { recordBlock } = require('../services/episodeStoryRecord');
const { canonBlock } = require('../services/storyCanon');

const router = express.Router();
const MODELS = ['claude-sonnet-4-6'];
const CHECK_MODEL = 'claude-haiku-4-5-20251001';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORY_LIMIT = 14000;   // characters of the short story a prompt carries

let client = null;
const getClient = () => { if (!client) client = new Anthropic(); return client; };
const getDb = (req) => req.app.locals.db || require('../models');

const CANON = `CANON (docs/CANON.md):
- JustAWoman lives in her world (the real one) and writes Lala's world. She created Lala, a sentient fashion game and AI character. Lala does not know JustAWoman exists.
- Book 1 cast (JustAWoman's world): her husband David; her sons Elias (9, the quiet witness) and Zion (5, the loud anchor); Marcus, the paying man (never a son); Nia Vale, the Comparison Creator; the Witness, unnamed.
- JustAWoman pours so much of herself into Lala that her consciousness transfers into Lala. The Lala bleed (one intrusive thought, once, not Lala speaking) comes in the first chapter after the transfer.`;

/** Asks the first model that answers; returns the text. */
async function ask({ models = MODELS, system, prompt, maxTokens }) {
  let lastErr = null;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const res = await getClient().messages.create({
          model, max_tokens: maxTokens, ...(system ? { system } : {}),
          messages: [{ role: 'user', content: prompt }],
        });
        return (res.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
      } catch (err) {
        lastErr = err;
        console.warn(`[book-from-show] ${model} attempt ${attempt + 1} failed:`, err.message);
      }
    }
  }
  throw lastErr || new Error('No model answered');
}

const parseJson = (raw) => {
  const match = String(raw || '').match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : raw);
};

async function chapterRow(sequelize, id) {
  const [[row]] = await sequelize.query(
    `SELECT id, book_id, title, chapter_number, sort_order, draft_prose, episode_id,
            scene_goal, chapter_notes, emotional_state_start, emotional_state_end
       FROM storyteller_chapters WHERE id = :id AND deleted_at IS NULL`, { replacements: { id } });
  return row || null;
}

async function episodeRow(sequelize, id) {
  const [[row]] = await sequelize.query(
    `SELECT id, show_id, episode_number, title, description, status, air_date
       FROM episodes WHERE id = :id AND deleted_at IS NULL`, { replacements: { id } });
  return row || null;
}

/** The episode's short story: the newest, published first. */
async function shortStoryOf(sequelize, episodeId) {
  const [[row]] = await sequelize.query(
    `SELECT id, title, content, status, word_count, metadata
       FROM stories
      WHERE episode_id = :episodeId AND format = 'short_story' AND deleted_at IS NULL
      ORDER BY (status = 'published') DESC, created_at DESC LIMIT 1`, { replacements: { episodeId } });
  return row || null;
}

const clip = (text, n) => {
  const s = String(text || '');
  return s.length > n ? `${s.slice(0, n)}\n[…]` : s;
};

// ── Ledger ──────────────────────────────────────────────────────────────────

/**
 * The book's ledger: each episode of the show with its short story (and beat
 * 11 piece) and the book's chapter for it, and what the book owes. The show
 * is the book's, else queryShowId. Returns { book, showId, episodes, owed }
 * or { status, error }.
 */
async function ledgerOf(sequelize, bookId, queryShowId) {
  const [[book]] = await sequelize.query(
    'SELECT id, title, show_id FROM storyteller_books WHERE id = :bookId AND deleted_at IS NULL', { replacements: { bookId } });
  if (!book) return { status: 404, error: 'Book not found' };
  const showId = book.show_id || (UUID_RE.test(String(queryShowId || '')) ? queryShowId : null);
  if (!showId) return { status: 400, error: 'This book is not tied to a show. Choose the show.', needs_show: true };

  const [rows] = await sequelize.query(`
    SELECT e.id, e.episode_number, e.title, e.status, e.air_date,
           s.id AS story_id, s.status AS story_status, s.word_count AS story_words,
           (s.metadata ? 'beat11_excerpt') AS has_beat11,
           c.id AS chapter_id, c.title AS chapter_title,
           (COALESCE(BTRIM(c.draft_prose), '') <> '') AS chapter_written
      FROM episodes e
      LEFT JOIN LATERAL (
        SELECT st.id, st.status, st.word_count, st.metadata FROM stories st
         WHERE st.episode_id = e.id AND st.format = 'short_story' AND st.deleted_at IS NULL
         ORDER BY (st.status = 'published') DESC, st.created_at DESC LIMIT 1
      ) s ON true
      LEFT JOIN LATERAL (
        SELECT ch.id, ch.title, ch.draft_prose FROM storyteller_chapters ch
         WHERE ch.book_id = :bookId AND ch.episode_id = e.id AND ch.deleted_at IS NULL
         ORDER BY ch.sort_order NULLS LAST LIMIT 1
      ) c ON true
     WHERE e.show_id = :showId AND e.deleted_at IS NULL
     ORDER BY e.episode_number NULLS LAST, e.created_at`, { replacements: { bookId, showId } });

  const episodes = rows.map((r) => ({
    id: r.id, episode_number: r.episode_number, title: r.title, status: r.status, air_date: r.air_date,
    short_story: r.story_id ? { id: r.story_id, status: r.story_status, word_count: r.story_words || 0, has_beat11: Boolean(r.has_beat11) } : null,
    chapter: r.chapter_id ? { id: r.chapter_id, title: r.chapter_title, written: Boolean(r.chapter_written) } : null,
  }));
  const owed = {
    short_stories: episodes.filter((e) => !e.short_story).length,
    beat11: episodes.filter((e) => e.short_story && !e.short_story.has_beat11).length,
    chapters: episodes.filter((e) => !e.chapter || !e.chapter.written).length,
  };
  return { book, showId, episodes, owed };
}


router.get('/books/:bookId/ledger', requireAuth, async (req, res) => {
  try {
    const { bookId } = req.params;
    if (!UUID_RE.test(bookId)) return res.status(400).json({ success: false, error: 'bookId must be a UUID' });
    const { sequelize } = getDb(req);
    const found = await ledgerOf(sequelize, bookId, req.query.show_id);
    if (found.error) return res.status(found.status).json({ success: false, error: found.error, ...(found.needs_show ? { needs_show: true } : {}) });
    const { book, showId, episodes, owed } = found;
    const transfer = await transferOf(sequelize, showId);
    return res.json({ success: true, book: { id: book.id, title: book.title }, show_id: showId, episodes, owed, transfer });
  } catch (err) {
    console.error('[book-from-show] GET ledger error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── A chapter's episode ─────────────────────────────────────────────────────

router.get('/chapters/:id/episode', requireAuth, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id must be a UUID' });
    const { sequelize } = getDb(req);
    const chapter = await chapterRow(sequelize, req.params.id);
    if (!chapter) return res.status(404).json({ success: false, error: 'Chapter not found' });
    if (!chapter.episode_id) return res.json({ success: true, episode: null, short_story: null });
    const episode = await episodeRow(sequelize, chapter.episode_id);
    const story = episode ? await shortStoryOf(sequelize, episode.id) : null;
    return res.json({
      success: true,
      episode: episode ? { id: episode.id, show_id: episode.show_id, episode_number: episode.episode_number, title: episode.title } : null,
      short_story: story ? { id: story.id, title: story.title, status: story.status, word_count: story.word_count || 0 } : null,
    });
  } catch (err) {
    console.error('[book-from-show] GET chapter episode error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/chapters/:id/episode', requireAuth, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id must be a UUID' });
    const episodeId = req.body?.episode_id ?? null;
    if (episodeId !== null && !UUID_RE.test(String(episodeId))) {
      return res.status(400).json({ success: false, error: 'episode_id must be an episode id or null' });
    }
    const { sequelize } = getDb(req);
    const chapter = await chapterRow(sequelize, req.params.id);
    if (!chapter) return res.status(404).json({ success: false, error: 'Chapter not found' });
    if (episodeId) {
      if (!(await episodeRow(sequelize, episodeId))) return res.status(404).json({ success: false, error: 'Episode not found' });
      const [[other]] = await sequelize.query(
        `SELECT id, title FROM storyteller_chapters
          WHERE book_id = :bookId AND episode_id = :episodeId AND id <> :id AND deleted_at IS NULL LIMIT 1`,
        { replacements: { bookId: chapter.book_id, episodeId, id: chapter.id } });
      if (other) {
        return res.status(409).json({ success: false, error: `"${other.title || 'Another chapter'}" is already this episode's chapter.`, chapter_id: other.id });
      }
    }
    await sequelize.query(
      'UPDATE storyteller_chapters SET episode_id = :episodeId, updated_at = NOW() WHERE id = :id',
      { replacements: { episodeId, id: chapter.id } });
    return res.json({ success: true, chapter_id: chapter.id, episode_id: episodeId });
  } catch (err) {
    console.error('[book-from-show] PUT chapter episode error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── Write the chapter from its episode ──────────────────────────────────────

/** The transfer episode of a show: { episode_id, episode_number, title } or null. */
async function transferOf(sequelize, showId) {
  if (!showId) return null;
  const [[row]] = await sequelize.query(
    `SELECT e.id AS episode_id, e.episode_number, e.title
       FROM shows s
       JOIN episodes e ON e.deleted_at IS NULL
        AND e.id::text = (s.metadata::jsonb -> 'consciousness_transfer' ->> 'episode_id')
      WHERE s.id = :showId`, { replacements: { showId } });
  return row || null;
}

/**
 * Where this chapter stands to the transfer:
 *   'unset'   no transfer episode yet: no bleed
 *   'before'  its episode is the transfer episode or earlier: no bleed
 *   'bleed'   the first chapter of this book after the transfer: the bleed
 *   'after'   a later chapter: the bleed already came
 */
async function bleedStateOf(sequelize, { transfer, episode, bookId }) {
  if (!transfer || transfer.episode_number == null || episode.episode_number == null) return 'unset';
  if (episode.episode_number <= transfer.episode_number) return 'before';
  const [[first]] = await sequelize.query(
    `SELECT MIN(e.episode_number) AS n
       FROM storyteller_chapters c JOIN episodes e ON e.id = c.episode_id AND e.deleted_at IS NULL
      WHERE c.book_id = :bookId AND c.deleted_at IS NULL AND e.episode_number > :t`,
    { replacements: { bookId, t: transfer.episode_number } });
  return first?.n == null || Number(first.n) >= Number(episode.episode_number) ? 'bleed' : 'after';
}

const BLEED_LINES = {
  unset: 'THE LALA BLEED: the consciousness transfer is not placed yet. Write no bleed.',
  before: 'THE LALA BLEED: the consciousness transfer has not happened yet at this point. Write no bleed.',
  bleed: 'THE LALA BLEED: this is the first chapter after the consciousness transfer. Include the bleed: ONE intrusive thought, once — Lala\'s register (styled, confident, unbothered, slightly uncanny) surfacing in JustAWoman\'s narration. Not Lala speaking. JustAWoman does not understand it.',
  after: 'THE LALA BLEED: it already came in an earlier chapter. Write no bleed.',
};

/**
 * What the LalaVerse said on The Pulse about the episode and its event (live
 * posts only). The episode's event is the one rule (utils/episodeEventSql).
 */
async function pulseAbout(sequelize, episodeId) {
  const [rows] = await sequelize.query(
    `SELECT fp.poster_handle, fp.poster_display_name, fp.content_text
       FROM feed_posts fp
      WHERE fp.deleted_at IS NULL AND fp.status = 'live' AND COALESCE(BTRIM(fp.content_text), '') <> ''
        AND (fp.episode_id = :episodeId OR fp.event_id = ${EPISODE_EVENT_ID_SQL})
      ORDER BY fp.story_order NULLS LAST, fp.created_at
      LIMIT 12`, { replacements: { episodeId } });
  return rows.map((r) => `- @${String(r.poster_handle || '').replace(/^@/, '')}: ${clip(String(r.content_text).replace(/\s+/g, ' '), 280)}`).join('\n');
}

/** The chapter's plan (the planner's fields, or Evoni's own), for the prompt. */
function planOf(chapter) {
  const lines = [
    chapter.scene_goal && `Goal: ${clip(chapter.scene_goal, 600)}`,
    chapter.emotional_state_start && `She starts: ${clip(chapter.emotional_state_start, 300)}`,
    chapter.emotional_state_end && `She ends: ${clip(chapter.emotional_state_end, 300)}`,
    chapter.chapter_notes && `Notes: ${clip(chapter.chapter_notes, 1500)}`,
  ].filter(Boolean);
  return lines.length ? `\nTHE PLAN FOR THIS CHAPTER (follow it):\n${lines.join('\n')}` : '';
}

function chapterPrompt({ chapter, episode, story, before, pulse = '', bleed = 'unset', record = '', canon = '' }) {
  return `${CANON}

You are writing a chapter of JustAWoman's book. The book follows the show, Styling Adventures with Lala:
- the episode is what the viewer sees;
- the short story is the event in full;
- THIS CHAPTER is everything the viewer does not see: JustAWoman's own life in her world while she builds and plays this episode, and the juicy details she, in her prime, imagines happening in Lala's world beyond the event.

Write in JustAWoman's first person. Do not retell the short story: the reader has it. Let its event sit at the edge of the chapter: before it, around it, after it, behind the screen. Vary sentence rhythm: short when doubt peaks, longer when something opens. Do not give her clarity she hasn't earned.

THE EPISODE: Episode ${episode.episode_number ?? '?'}: "${episode.title || 'Untitled'}"${episode.description ? `\n${clip(episode.description, 1200)}` : ''}

${record ? `${record}\n\n` : ''}THE SHORT STORY (what the reader already knows):
${story ? clip(story.content, STORY_LIMIT) : '(not written yet: work from the episode alone)'}
${canon ? `\n${canon}\n` : ''}${pulse ? `\nWHAT THE LALAVERSE SAID ON THE PULSE (JustAWoman sees it; she may react to it):\n${pulse}\n` : ''}${before ? `\nTHE END OF THE CHAPTER BEFORE (for continuity):\n${before}\n` : ''}
${BLEED_LINES[bleed] || BLEED_LINES.unset}

THIS CHAPTER: "${chapter.title || `Chapter ${chapter.chapter_number || ''}`.trim()}"${planOf(chapter)}

Answer with the chapter's prose only: no title, no notes. About 1,800 to 2,500 words.`;
}

router.post('/chapters/:id/write-from-episode', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id must be a UUID' });
    const { sequelize } = getDb(req);
    const chapter = await chapterRow(sequelize, req.params.id);
    if (!chapter) return res.status(404).json({ success: false, error: 'Chapter not found' });
    if (!chapter.episode_id) return res.status(409).json({ success: false, error: 'Choose this chapter\'s episode first.' });
    const episode = await episodeRow(sequelize, chapter.episode_id);
    if (!episode) return res.status(409).json({ success: false, error: 'This chapter\'s episode is gone. Choose another.' });
    const story = await shortStoryOf(sequelize, episode.id);
    const [[prev]] = await sequelize.query(
      `SELECT draft_prose FROM storyteller_chapters
        WHERE book_id = :bookId AND deleted_at IS NULL AND id <> :id
          AND COALESCE(sort_order, chapter_number, 0) < COALESCE(:order, 0)
        ORDER BY COALESCE(sort_order, chapter_number, 0) DESC LIMIT 1`,
      { replacements: { bookId: chapter.book_id, id: chapter.id, order: chapter.sort_order ?? chapter.chapter_number ?? 0 } });
    const before = prev?.draft_prose ? prev.draft_prose.trim().slice(-1500) : '';

    const pulse = await pulseAbout(sequelize, episode.id);
    const transfer = await transferOf(sequelize, episode.show_id);
    const bleed = await bleedStateOf(sequelize, { transfer, episode, bookId: chapter.book_id });

    const record = await recordBlock(sequelize, episode.id);
    const canon = await canonBlock(sequelize, episode.id);

    const prose = await ask({ prompt: chapterPrompt({ chapter, episode, story, before, pulse, bleed, record, canon }), maxTokens: 5000 });
    if (!prose) return res.status(502).json({ success: false, error: 'The draft came back empty. Try again.' });
    return res.json({ success: true, prose, used_short_story: Boolean(story), used_pulse_posts: pulse ? pulse.split('\n').length : 0, used_story_record: Boolean(record), bleed, saved: false });
  } catch (err) {
    console.error('[book-from-show] write-from-episode error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── Check the chapter against the short story ───────────────────────────────

router.post('/chapters/:id/check-against-story', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id must be a UUID' });
    const { sequelize } = getDb(req);
    const chapter = await chapterRow(sequelize, req.params.id);
    if (!chapter) return res.status(404).json({ success: false, error: 'Chapter not found' });
    const prose = typeof req.body?.prose === 'string' && req.body.prose.trim() ? req.body.prose : chapter.draft_prose;
    if (!prose || !prose.trim()) return res.status(409).json({ success: false, error: 'The chapter has no prose to check yet.' });
    if (!chapter.episode_id) return res.status(409).json({ success: false, error: 'Choose this chapter\'s episode first.' });
    const story = await shortStoryOf(sequelize, chapter.episode_id);
    if (!story?.content) return res.status(409).json({ success: false, error: 'This episode has no short story yet.' });

    const raw = await ask({
      models: [CHECK_MODEL, ...MODELS],
      maxTokens: 1500,
      prompt: `${CANON}

A book chapter (JustAWoman's point of view: what the viewer does not see) must not contradict the short story of the same episode (the event in full). List only real contradictions of fact: who was where, what happened, what was said, the order of events, names. Different emphasis, things the story does not mention, and JustAWoman imagining what is behind the screen are not contradictions.

THE SHORT STORY:
${clip(story.content, STORY_LIMIT)}

THE CHAPTER:
${clip(prose, STORY_LIMIT)}

Answer with JSON only:
{"issues": [{"chapter_says": "short quote or paraphrase", "story_says": "short quote or paraphrase", "why": "one sentence"}]}
An empty list when there are none.`,
    });
    let parsed;
    try { parsed = parseJson(raw); } catch (parseErr) {
      console.error('[book-from-show] check: answer was not JSON:', parseErr.message);
      return res.status(502).json({ success: false, error: 'The check came back in a form that could not be read. Try again.' });
    }
    const issues = (Array.isArray(parsed?.issues) ? parsed.issues : [])
      .filter((i) => i && (i.chapter_says || i.story_says))
      .map((i) => ({ chapter_says: String(i.chapter_says || ''), story_says: String(i.story_says || ''), why: String(i.why || '') }));
    return res.json({ success: true, story_id: story.id, issues });
  } catch (err) {
    console.error('[book-from-show] check-against-story error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── Plan the next chapters from the episodes ────────────────────────────────
// The book follows the show, so its plan does too: this replaces the Story
// Engine's fixed 50-chapter plan (memories/engine.js ARC_SYSTEM_PROMPT) for
// the book. A plan is a preview; apply writes it.

const PLAN_MAX = 8;
const PLAN_FIELDS = ['scene_goal', 'emotional_state_start', 'emotional_state_end', 'chapter_notes'];

/** Which planned episode gets the bleed: the first after the transfer, among chapters there and planned. */
function planBleed(transfer, episodes, plannedIds) {
  if (!transfer || transfer.episode_number == null) return null;
  const withChapter = episodes.filter((e) => (e.chapter || plannedIds.has(e.id)) && e.episode_number != null && e.episode_number > transfer.episode_number);
  withChapter.sort((a, b) => a.episode_number - b.episode_number);
  return withChapter[0]?.id || null;
}

router.post('/books/:bookId/plan', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { bookId } = req.params;
    if (!UUID_RE.test(bookId)) return res.status(400).json({ success: false, error: 'bookId must be a UUID' });
    const count = Math.min(PLAN_MAX, Math.max(1, parseInt(req.body?.count, 10) || 4));
    const { sequelize } = getDb(req);
    const found = await ledgerOf(sequelize, bookId, req.body?.show_id);
    if (found.error) return res.status(found.status).json({ success: false, error: found.error, ...(found.needs_show ? { needs_show: true } : {}) });
    const { showId, episodes } = found;
    const todo = episodes.filter((e) => !e.chapter || !e.chapter.written).slice(0, count);
    if (todo.length === 0) return res.json({ success: true, plan: [], message: 'Every episode has its chapter.' });

    const transfer = await transferOf(sequelize, showId);
    const bleedId = planBleed(transfer, episodes, new Set(todo.map((e) => e.id)));
    const details = [];
    for (const e of todo) {
      const full = await episodeRow(sequelize, e.id);
      const story = e.short_story ? await shortStoryOf(sequelize, e.id) : null;
      details.push(`- episode_id ${e.id} — Episode ${e.episode_number ?? '?'}: "${e.title || 'Untitled'}"`
        + (full?.description ? `\n  What it is: ${clip(full.description, 500)}` : '')
        + (story?.content ? `\n  Its short story begins: ${clip(story.content.replace(/\s+/g, ' '), 1200)}` : '\n  (No short story yet.)')
        + (e.id === bleedId ? '\n  THE LALA BLEED goes in this chapter: the first after the consciousness transfer.' : ''));
    }
    const [recent] = await sequelize.query(
      `SELECT title, scene_goal, chapter_notes FROM storyteller_chapters
        WHERE book_id = :bookId AND deleted_at IS NULL AND COALESCE(BTRIM(draft_prose), '') <> ''
        ORDER BY COALESCE(sort_order, chapter_number, 0) DESC LIMIT 3`, { replacements: { bookId } });
    const before = recent.reverse().map((c) => `- "${c.title || 'Untitled'}"${c.scene_goal ? `: ${clip(c.scene_goal, 200)}` : ''}`).join('\n');

    const raw = await ask({
      maxTokens: 3500,
      prompt: `${CANON}

You plan chapters of JustAWoman's book. The book follows the show, Styling Adventures with Lala: the episode is what the viewer sees, the short story is the event in full, and each chapter is everything the viewer does not see, in JustAWoman's first person: her own life in her world while she builds and plays that episode, and the juicy details she, in her prime, imagines happening in Lala's world beyond the event.
${transfer ? `The consciousness transfer happens in Episode ${transfer.episode_number}.` : 'The consciousness transfer is not placed yet: plan no bleed.'}
${before ? `\nTHE LAST CHAPTERS WRITTEN:\n${before}\n` : ''}
PLAN ONE CHAPTER FOR EACH OF THESE EPISODES, in order:
${details.join('\n')}

Answer with JSON only:
{"chapters": [{"episode_id": "the id above", "title": "chapter title", "scene_goal": "what this chapter does, one or two sentences", "emotional_state_start": "where she starts", "emotional_state_end": "where she ends", "chapter_notes": "what the viewer does not see: her day, who from her world presses on her (David, Elias, Zion, Marcus, Nia Vale, the Witness...), and what she imagines in Lala's world; 3 to 6 sentences"}]}`,
    });
    let parsed;
    try { parsed = parseJson(raw); } catch (parseErr) {
      console.error('[book-from-show] plan: answer was not JSON:', parseErr.message);
      return res.status(502).json({ success: false, error: 'The plan came back in a form that could not be read. Try again.' });
    }
    const byId = new Map(todo.map((e) => [e.id, e]));
    const plan = (Array.isArray(parsed?.chapters) ? parsed.chapters : [])
      .filter((c) => c && byId.has(c.episode_id))
      .map((c) => {
        const e = byId.get(c.episode_id);
        const item = { episode_id: e.id, episode_number: e.episode_number, episode_title: e.title, chapter_id: e.chapter?.id || null,
          title: String(c.title || '').trim().slice(0, 255) || `Episode ${e.episode_number ?? ''}`.trim(), bleed: e.id === bleedId };
        for (const f of PLAN_FIELDS) item[f] = typeof c[f] === 'string' ? c[f].trim() : '';
        return item;
      });
    if (plan.length === 0) return res.status(502).json({ success: false, error: 'The plan came back empty. Try again.' });
    return res.json({ success: true, plan, transfer, saved: false });
  } catch (err) {
    console.error('[book-from-show] plan error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Writes a plan: a new chapter for an episode with none, tied to it; an
 * episode's existing chapter only has its empty plan fields filled, never
 * overwritten (Evoni's own notes stay).
 */
router.post('/books/:bookId/plan/apply', requireAuth, async (req, res) => {
  try {
    const { bookId } = req.params;
    if (!UUID_RE.test(bookId)) return res.status(400).json({ success: false, error: 'bookId must be a UUID' });
    const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, PLAN_MAX) : [];
    if (items.length === 0) return res.status(400).json({ success: false, error: 'items is required' });
    const { sequelize } = getDb(req);
    const found = await ledgerOf(sequelize, bookId, req.body?.show_id);
    if (found.error) return res.status(found.status).json({ success: false, error: found.error });
    const byId = new Map(found.episodes.map((e) => [e.id, e]));
    const text = (v, n) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);
    let created = 0;
    let filled = 0;
    const chapters = [];
    for (const item of items) {
      const e = byId.get(item?.episode_id);
      if (!e) return res.status(400).json({ success: false, error: 'An item names an episode that is not in this show.' });
      const values = Object.fromEntries(PLAN_FIELDS.map((f) => [f, text(item[f], 4000)]));
      if (e.chapter) {
        const sets = PLAN_FIELDS.filter((f) => values[f]).map((f) => `${f} = COALESCE(NULLIF(BTRIM(${f}), ''), :${f})`);
        if (sets.length) {
          await sequelize.query(`UPDATE storyteller_chapters SET ${sets.join(', ')}, updated_at = NOW() WHERE id = :id`,
            { replacements: { id: e.chapter.id, ...values } });
          filled += 1;
        }
        chapters.push(e.chapter.id);
      } else {
        const [[last]] = await sequelize.query(
          `SELECT COALESCE(MAX(sort_order), 0) AS o, COALESCE(MAX(chapter_number), 0) AS n
             FROM storyteller_chapters WHERE book_id = :bookId AND deleted_at IS NULL`, { replacements: { bookId } });
        // SQL, not the model: the model declares columns (sections,
        // chapter_template) that no migration creates.
        const chapter = { id: uuidv4(), title: text(item.title, 255) || `Episode ${e.episode_number ?? ''}: ${e.title || 'Untitled'}` };
        await sequelize.query(
          `INSERT INTO storyteller_chapters
             (id, book_id, chapter_number, sort_order, title, episode_id,
              scene_goal, emotional_state_start, emotional_state_end, chapter_notes, created_at, updated_at)
           VALUES (:id, :bookId, :n, :o, :title, :episodeId,
              :scene_goal, :emotional_state_start, :emotional_state_end, :chapter_notes, NOW(), NOW())`,
          { replacements: { id: chapter.id, bookId, n: Number(last.n) + 1, o: Number(last.o) + 1, title: chapter.title, episodeId: e.id, ...values } });
        e.chapter = { id: chapter.id, title: chapter.title, written: false };
        created += 1;
        chapters.push(chapter.id);
      }
    }
    return res.json({ success: true, created, filled, chapters });
  } catch (err) {
    console.error('[book-from-show] plan apply error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── The consciousness transfer ──────────────────────────────────────────────

router.get('/shows/:showId/transfer', requireAuth, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.showId)) return res.status(400).json({ success: false, error: 'showId must be a UUID' });
    const { sequelize } = getDb(req);
    return res.json({ success: true, transfer: await transferOf(sequelize, req.params.showId) });
  } catch (err) {
    console.error('[book-from-show] GET transfer error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/shows/:showId/transfer', requireAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    if (!UUID_RE.test(showId)) return res.status(400).json({ success: false, error: 'showId must be a UUID' });
    const episodeId = req.body?.episode_id ?? null;
    if (episodeId !== null && !UUID_RE.test(String(episodeId))) {
      return res.status(400).json({ success: false, error: 'episode_id must be an episode id or null' });
    }
    const { sequelize } = getDb(req);
    const [[show]] = await sequelize.query('SELECT id FROM shows WHERE id = :showId AND deleted_at IS NULL', { replacements: { showId } });
    if (!show) return res.status(404).json({ success: false, error: 'Show not found' });
    if (episodeId) {
      const episode = await episodeRow(sequelize, episodeId);
      if (!episode || episode.show_id !== showId) return res.status(404).json({ success: false, error: 'That episode is not in this show.' });
    }
    const value = episodeId ? JSON.stringify({ episode_id: episodeId, set_at: new Date().toISOString() }) : null;
    await sequelize.query(
      `UPDATE shows SET metadata = (CASE WHEN CAST(:value AS text) IS NULL
                                         THEN COALESCE(metadata::jsonb, '{}'::jsonb) - 'consciousness_transfer'
                                         ELSE COALESCE(metadata::jsonb, '{}'::jsonb) || jsonb_build_object('consciousness_transfer', CAST(:value AS jsonb)) END)::json,
                        updated_at = NOW()
        WHERE id = :showId`, { replacements: { showId, value } });
    return res.json({ success: true, transfer: await transferOf(sequelize, showId) });
  } catch (err) {
    console.error('[book-from-show] PUT transfer error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── The beat 11 excerpt ─────────────────────────────────────────────────────

async function shortStoryById(sequelize, id) {
  const [[row]] = await sequelize.query(
    `SELECT id, episode_id, format, content, metadata FROM stories WHERE id = :id AND deleted_at IS NULL`,
    { replacements: { id } });
  return row || null;
}

async function saveExcerpt(sequelize, id, excerpt) {
  await sequelize.query(
    `UPDATE stories SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{beat11_excerpt}', CAST(:excerpt AS jsonb)),
                        updated_at = NOW()
      WHERE id = :id`,
    { replacements: { id, excerpt: JSON.stringify(excerpt) } });
}

// ── The Episode Story Record (stage C; services/episodeStoryRecord) ─────────

const recordError = (res, err, label) => {
  const { RecordError } = require('../services/episodeStoryRecord');
  if (err instanceof RecordError) return res.status(err.status).json({ success: false, error: err.message });
  console.error(`[book-from-show] ${label} error:`, err);
  return res.status(500).json({ success: false, error: err.message });
};

router.get('/episodes/:episodeId/record', requireAuth, async (req, res) => {
  try {
    const { getRecord } = require('../services/episodeStoryRecord');
    return res.json({ success: true, ...(await getRecord(getDb(req).sequelize, req.params.episodeId)) });
  } catch (err) {
    return recordError(res, err, 'GET episode record');
  }
});

router.post('/episodes/:episodeId/record/draft', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { draftRecord } = require('../services/episodeStoryRecord');
    return res.json({ success: true, ...(await draftRecord(getDb(req).sequelize, req.params.episodeId)) });
  } catch (err) {
    return recordError(res, err, 'POST episode record draft');
  }
});

router.put('/episodes/:episodeId/record', requireAuth, async (req, res) => {
  try {
    const { updateRecord } = require('../services/episodeStoryRecord');
    return res.json({ success: true, ...(await updateRecord(getDb(req).sequelize, req.params.episodeId, req.body || {})) });
  } catch (err) {
    return recordError(res, err, 'PUT episode record');
  }
});

router.post('/episodes/:episodeId/record/approve', requireAuth, async (req, res) => {
  try {
    const { approveRecord } = require('../services/episodeStoryRecord');
    const by = String(req.user?.email || req.user?.id || 'author').slice(0, 255);
    return res.json({ success: true, ...(await approveRecord(getDb(req).sequelize, req.params.episodeId, { by })) });
  } catch (err) {
    return recordError(res, err, 'POST episode record approve');
  }
});

// ── Canon approval for short stories (stage D; services/storyCanon) ────────

const canonError = (res, err, label) => {
  const { CanonError } = require('../services/storyCanon');
  if (err instanceof CanonError) return res.status(err.status).json({ success: false, error: err.message });
  console.error(`[book-from-show] ${label} error:`, err);
  return res.status(500).json({ success: false, error: err.message });
};
const deciderOf = (req) => String(req.user?.email || req.user?.id || 'author').slice(0, 255);

router.get('/episodes/:episodeId/canon', requireAuth, async (req, res) => {
  try {
    const { listCanon } = require('../services/storyCanon');
    return res.json({ success: true, ...(await listCanon(getDb(req).sequelize, req.params.episodeId)) });
  } catch (err) {
    return canonError(res, err, 'GET episode canon');
  }
});

router.post('/stories/:storyId/canon/review', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { reviewStory } = require('../services/storyCanon');
    return res.json({ success: true, ...(await reviewStory(getDb(req).sequelize, req.params.storyId)) });
  } catch (err) {
    return canonError(res, err, 'POST story canon review');
  }
});

router.post('/canon/:proposalId/accept', requireAuth, async (req, res) => {
  try {
    const { acceptProposal } = require('../services/storyCanon');
    return res.json({ success: true, ...(await acceptProposal(getDb(req).sequelize, req.params.proposalId, { by: deciderOf(req) })) });
  } catch (err) {
    return canonError(res, err, 'POST canon accept');
  }
});

router.post('/canon/:proposalId/dismiss', requireAuth, async (req, res) => {
  try {
    const { dismissProposal } = require('../services/storyCanon');
    return res.json({ success: true, ...(await dismissProposal(getDb(req).sequelize, req.params.proposalId, { by: deciderOf(req) })) });
  } catch (err) {
    return canonError(res, err, 'POST canon dismiss');
  }
});

// The episode's beat 11 piece, for the Scene Planner's beat 11 (production).
router.get('/episodes/:episodeId/beat11', requireAuth, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.episodeId)) return res.status(400).json({ success: false, error: 'episodeId must be a UUID' });
    const { sequelize } = getDb(req);
    const story = await shortStoryOf(sequelize, req.params.episodeId);
    return res.json({ success: true, story_id: story?.id || null, excerpt: story?.metadata?.beat11_excerpt || null });
  } catch (err) {
    console.error('[book-from-show] GET episode beat11 error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/stories/:storyId/beat11-excerpt', requireAuth, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.storyId)) return res.status(400).json({ success: false, error: 'storyId must be a UUID' });
    const { sequelize } = getDb(req);
    const story = await shortStoryById(sequelize, req.params.storyId);
    if (!story) return res.status(404).json({ success: false, error: 'Story not found' });
    return res.json({ success: true, story_id: story.id, is_short_story: story.format === 'short_story', excerpt: story.metadata?.beat11_excerpt || null });
  } catch (err) {
    console.error('[book-from-show] GET beat11 excerpt error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/stories/:storyId/beat11-excerpt', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.storyId)) return res.status(400).json({ success: false, error: 'storyId must be a UUID' });
    const { sequelize } = getDb(req);
    const story = await shortStoryById(sequelize, req.params.storyId);
    if (!story) return res.status(404).json({ success: false, error: 'Story not found' });
    if (story.format !== 'short_story') return res.status(409).json({ success: false, error: 'Only a short story has a beat 11 piece.' });
    if (!story.content || !story.content.trim()) return res.status(409).json({ success: false, error: 'The short story has no text yet.' });

    const raw = await ask({
      maxTokens: 800,
      prompt: `In Styling Adventures with Lala, beat 11 (Event Outcome) plays a short animated piece of the episode's short story. It is the hook: the viewer should finish it asking "what happened at that event?" The full answer is the short story.

Cut that piece from the short story below: one continuous passage, 80 to 150 words, that can be animated in 30 to 60 seconds. Pick a moment that raises the question and does not answer it. Use the story's own words; you may trim within the passage, but do not add to it.

THE SHORT STORY:
${clip(story.content, STORY_LIMIT)}

Answer with JSON only:
{"text": "the passage", "why": "one sentence: the question it leaves the viewer with"}`,
    });
    let parsed;
    try { parsed = parseJson(raw); } catch (parseErr) {
      console.error('[book-from-show] beat11: answer was not JSON:', parseErr.message);
      return res.status(502).json({ success: false, error: 'The excerpt came back in a form that could not be read. Try again.' });
    }
    const text = typeof parsed?.text === 'string' ? parsed.text.trim() : '';
    if (!text) return res.status(502).json({ success: false, error: 'The excerpt came back empty. Try again.' });
    const excerpt = { text, why: typeof parsed.why === 'string' ? parsed.why.trim() : '', for_animation: true, generated: true, saved_at: new Date().toISOString() };
    await saveExcerpt(sequelize, story.id, excerpt);
    return res.json({ success: true, story_id: story.id, excerpt });
  } catch (err) {
    console.error('[book-from-show] beat11 excerpt error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/stories/:storyId/beat11-excerpt', requireAuth, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.storyId)) return res.status(400).json({ success: false, error: 'storyId must be a UUID' });
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) return res.status(400).json({ success: false, error: 'text is required' });
    if (text.length > 3000) return res.status(400).json({ success: false, error: 'The beat 11 piece is too long (3,000 characters at most).' });
    const { sequelize } = getDb(req);
    const story = await shortStoryById(sequelize, req.params.storyId);
    if (!story) return res.status(404).json({ success: false, error: 'Story not found' });
    if (story.format !== 'short_story') return res.status(409).json({ success: false, error: 'Only a short story has a beat 11 piece.' });
    const prior = story.metadata?.beat11_excerpt || {};
    const excerpt = { ...prior, text, for_animation: true, generated: false, saved_at: new Date().toISOString() };
    await saveExcerpt(sequelize, story.id, excerpt);
    return res.json({ success: true, story_id: story.id, excerpt });
  } catch (err) {
    console.error('[book-from-show] PUT beat11 excerpt error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
module.exports.chapterPrompt = chapterPrompt;

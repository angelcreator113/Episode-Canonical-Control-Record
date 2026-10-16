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
 *        a draft of the chapter from its episode and short story; a preview,
 *        nothing is saved
 *   POST /api/v1/book-from-show/chapters/:id/check-against-story
 *        where the chapter's draft contradicts the short story
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
const Anthropic = require('@anthropic-ai/sdk');
const { requireAuth } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');

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
- The Lala bleed (one intrusive thought) comes only after the consciousness transfer, which has not happened yet. Write no bleed.`;

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
    `SELECT id, book_id, title, chapter_number, sort_order, draft_prose, episode_id
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

router.get('/books/:bookId/ledger', requireAuth, async (req, res) => {
  try {
    const { bookId } = req.params;
    if (!UUID_RE.test(bookId)) return res.status(400).json({ success: false, error: 'bookId must be a UUID' });
    const { sequelize } = getDb(req);
    const [[book]] = await sequelize.query(
      'SELECT id, title, show_id FROM storyteller_books WHERE id = :bookId AND deleted_at IS NULL', { replacements: { bookId } });
    if (!book) return res.status(404).json({ success: false, error: 'Book not found' });
    const showId = book.show_id || (UUID_RE.test(String(req.query.show_id || '')) ? req.query.show_id : null);
    if (!showId) return res.status(400).json({ success: false, error: 'This book is not tied to a show. Choose the show.', needs_show: true });

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
    return res.json({ success: true, book: { id: book.id, title: book.title }, show_id: showId, episodes, owed });
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

function chapterPrompt({ chapter, episode, story, before }) {
  return `${CANON}

You are writing a chapter of JustAWoman's book. The book follows the show, Styling Adventures with Lala:
- the episode is what the viewer sees;
- the short story is the event in full;
- THIS CHAPTER is everything the viewer does not see: JustAWoman's own life in her world while she builds and plays this episode, and the juicy details she, in her prime, imagines happening in Lala's world beyond the event.

Write in JustAWoman's first person. Do not retell the short story: the reader has it. Let its event sit at the edge of the chapter: before it, around it, after it, behind the screen. Vary sentence rhythm: short when doubt peaks, longer when something opens. Do not give her clarity she hasn't earned.

THE EPISODE: Episode ${episode.episode_number ?? '?'}: "${episode.title || 'Untitled'}"${episode.description ? `\n${clip(episode.description, 1200)}` : ''}

THE SHORT STORY (what the reader already knows):
${story ? clip(story.content, STORY_LIMIT) : '(not written yet: work from the episode alone)'}
${before ? `\nTHE END OF THE CHAPTER BEFORE (for continuity):\n${before}\n` : ''}
THIS CHAPTER: "${chapter.title || `Chapter ${chapter.chapter_number || ''}`.trim()}"

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

    const prose = await ask({ prompt: chapterPrompt({ chapter, episode, story, before }), maxTokens: 5000 });
    if (!prose) return res.status(502).json({ success: false, error: 'The draft came back empty. Try again.' });
    return res.json({ success: true, prose, used_short_story: Boolean(story), saved: false });
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

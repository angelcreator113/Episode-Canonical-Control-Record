'use strict';

/**
 * src/routes/generate-script-from-book.js
 *
 * POST /generate-script-from-book
 *
 * Reads approved book lines from a chapter (or the most-recent chapter with
 * approved lines) and feeds them through two Claude pipelines:
 *
 *   JLAW pipeline  — adapts book lines into narrator-voice episode beats
 *   Lala pipeline  — generates reactive dialogue from stat conditions + personality
 *
 * Mounted at: /api/v1/memories  (alongside the existing memories routes)
 *
 * Registration in app.js:
 *   const scriptFromBook = require('./routes/generate-script-from-book');
 *   app.use('/api/v1/memories', scriptFromBook);
 */

const express  = require('express');
const router   = express.Router();
const Anthropic = require('@anthropic-ai/sdk');

// ── Auth — mirrors existing PNOS routes (no auth) ────────────────────────
let optionalAuth;
try {
  const authModule = require('../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
} catch (e) {
  optionalAuth = (req, res, next) => next();
}

// ── Models ────────────────────────────────────────────────────────────────
const db = require('../models');
const { StorytellerBook, StorytellerChapter, StorytellerLine } = db;

// ── Anthropic client ──────────────────────────────────────────────────────
const anthropic = new Anthropic();

// ── Lala tone helper ──────────────────────────────────────────────────────
function deriveLalaTone(stats) {
  const { confidence = 50, reputation = 50, coins = 400 } = stats || {};
  if (confidence > 80) return 'bold-selective';
  if (confidence < 40) return 'determined-cautious';
  if (coins < 200)     return 'strategic-measured';
  if (reputation > 70) return 'poised-warm';
  return 'aspirational-warm';
}

function toneDescription(tone) {
  const map = {
    'bold-selective':     'Bold, selective — "Bestie, of course they invited me."',
    'determined-cautious': 'Determined, cautious — "Okay… I can do this."',
    'strategic-measured':  'Strategic, measured — "We need to be smart about this."',
    'poised-warm':         'Poised, warm — "We earned this. Let\'s enjoy it."',
    'aspirational-warm':   'Aspirational, warm — "Main character energy. Let\'s go."',
  };
  return map[tone] || tone;
}

// ── Prompt builders ───────────────────────────────────────────────────────

function buildJlawPrompt(lines, context) {
  const lineBlock = lines.map((l, i) => `${i + 1}. "${l.text}"`).join('\n');

  return `You are a script adapter for PNOS — the Personal Narrative Operating System.

You are adapting approved book lines written by "JustAWomanInHerPrime" into episode narrator beats.

VOICE RULES:
- First person. Interior. She thinks; she doesn't perform.
- Present tense unless reflecting on a past event.
- Rhythmic, honest, unpolished. Real monologue, not social media copy.
- Each beat is 1–3 sentences. One thought per beat.
- She is narrating her life as if the camera is always running — but she's not performing for it.

CONTEXT:
Book: "${context.book_title}"
Chapter: "${context.chapter_title}"
Event: ${context.event_name}
Event Prestige: ${context.event_prestige}/10
Dress Code: ${context.dress_code}
Stakes: ${context.stakes}
Episode Arc: ${context.episode_arc}
PNOS Act: ${context.pnos_act}
Current Belief: "${context.pnos_belief}"

APPROVED BOOK LINES TO ADAPT:
${lineBlock}

INSTRUCTIONS:
- Produce one narrator beat per source line.
- Preserve the emotional truth of each line. Do not invent new facts.
- Tag each beat with at least one tag from: [identity, ambition, fear, reflection, resolve, vulnerability, strategy, joy, doubt].
- Output ONLY valid JSON — no markdown fences, no preamble.

Return an array of objects:
[
  {
    "source_line_index": 0,
    "content": "the narrator beat text",
    "title": "short beat title (3-5 words)",
    "tags": ["identity", "resolve"],
    "hasJLAW": true,
    "hasLala": false
  }
]`;
}

function buildLalaPrompt(context) {
  return `You are Lala — the gamified alter-ego in the PNOS universe.

PERSONALITY:
- Lala speaks in third-person-adjacent inner voice: "We got this" / "Main character energy"
- She is strategic, warm, aspirational — but aware of the economics.
- She responds to stats, not narrative arcs.

CURRENT STATS:
- Confidence: ${context.lala_stats.confidence}/100
- Reputation: ${context.lala_stats.reputation}/100
- Coins: ${context.lala_stats.coins}

CURRENT TONE: ${toneDescription(context.lala_tone)}

SCENE CONTEXT:
Event: ${context.event_name}
Event Prestige: ${context.event_prestige}/10
Dress Code: ${context.dress_code}
Stakes: ${context.stakes}
Arc: ${context.episode_arc}

INSTRUCTIONS:
- Generate 3–5 Lala dialogue/reaction beats for this scene.
- Each beat is 1–2 sentences. In-character, stat-driven.
- If confidence is low, she's more cautious. If high, she's selective.
- If coins are low, she factors cost into decisions.
- Tag each beat from: [strategy, hype, caution, coins, reputation, confidence, humor].
- Output ONLY valid JSON — no markdown fences, no preamble.

Return an array:
[
  {
    "content": "lala's line",
    "title": "short beat title",
    "tags": ["strategy", "hype"],
    "hasJLAW": false,
    "hasLala": true
  }
]`;
}

function buildScriptPrompt(jlawBeats, lalaBeats, context) {
  const allBeats = [
    ...jlawBeats.map(b => ({ ...b, speaker: 'JLAW' })),
    ...lalaBeats.map(b => ({ ...b, speaker: 'LALA' })),
  ];

  const beatsBlock = allBeats.map((b, i) =>
    `${i + 1}. [${b.speaker}] "${b.content}"`
  ).join('\n');

  return `You are the final script assembler for a PNOS episode.

You have narrator beats from JustAWomanInHerPrime and dialogue beats from Lala.
Weave them into a single flowing episode script.

FORMAT RULES:
- Use [JLAW] and [LALA] speaker tags.
- Interleave naturally — JLAW narrates, Lala reacts or comments.
- Open with a JLAW beat. Close with either.
- Add brief stage/mood directions in parentheses where helpful.
- The script should feel like a real episode segment — 2–4 minutes of content.

BEATS TO WEAVE:
${beatsBlock}

CONTEXT:
Event: ${context.event_name} (Prestige ${context.event_prestige}/10)
PNOS Act: ${context.pnos_act}
Current Belief: "${context.pnos_belief}"
Lala Tone: ${toneDescription(context.lala_tone)}

Output the final script as plain text. No JSON. No markdown fences.
Just the script — speaker tags, lines, and directions.`;
}

// ── Route ─────────────────────────────────────────────────────────────────

router.post('/generate-script-from-book', optionalAuth, async (req, res) => {
  try {
    const {
      book_id,
      chapter_id,
      show_id,
      event_name     = 'Upcoming Event',
      event_prestige = 7,
      dress_code     = 'Luxury',
      stakes         = 'Building reputation',
      episode_arc    = 'ARC 1',
      pnos_act       = 'Act I — Pattern',
      pnos_belief    = 'If I find the right niche, everything will click.',
      line_count     = 5,
      lala_stats     = { confidence: 75, reputation: 50, coins: 400 },
    } = req.body;

    if (!book_id) {
      return res.status(400).json({ error: 'book_id is required' });
    }

    // ── Fetch book ────────────────────────────────────────────────────────
    const book = await StorytellerBook.findByPk(book_id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // ── Resolve chapter ──────────────────────────────────────────────────
    let chapter;
    if (chapter_id) {
      chapter = await StorytellerChapter.findByPk(chapter_id);
    }

    if (!chapter) {
      // Fall back to most recent chapter with approved lines
      const allChapters = await StorytellerChapter.findAll({
        where: { book_id },
        order: [['sort_order', 'DESC'], ['created_at', 'DESC']],
      });

      for (const ch of allChapters) {
        const hasApproved = await StorytellerLine.count({
          where: { chapter_id: ch.id, status: 'approved' },
        });
        if (hasApproved > 0) {
          chapter = ch;
          break;
        }
      }
    }

    if (!chapter) {
      return res.status(404).json({
        error: 'No chapter with approved lines found in this book',
      });
    }

    // ── Fetch approved lines ─────────────────────────────────────────────
    const approvedLines = await StorytellerLine.findAll({
      where: { chapter_id: chapter.id, status: 'approved' },
      order: [['sort_order', 'ASC'], ['created_at', 'ASC']],
      limit: Math.min(Number(line_count) || 5, 10),
    });

    if (approvedLines.length === 0) {
      return res.status(404).json({
        error: 'No approved lines in this chapter',
      });
    }

    const lala_tone = deriveLalaTone(lala_stats);

    const context = {
      book_title:     book.title,
      chapter_title:  chapter.title,
      event_name,
      event_prestige: Number(event_prestige),
      dress_code,
      stakes,
      episode_arc,
      pnos_act,
      pnos_belief,
      lala_stats,
      lala_tone,
    };

    // ── Pipeline 1: JLAW beats (from book lines) ─────────────────────────
    const jlawResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: buildJlawPrompt(approvedLines, context),
      }],
    });

    let jlawBeats;
    try {
      const jlawText = jlawResponse.content[0].text.trim();
      jlawBeats = JSON.parse(jlawText);
    } catch (parseErr) {
      console.error('JLAW parse error:', parseErr.message);
      return res.status(500).json({ error: 'Failed to parse JLAW beats from Claude' });
    }

    // ── Pipeline 2: Lala beats (from stats) ──────────────────────────────
    const lalaResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: buildLalaPrompt(context),
      }],
    });

    let lalaBeats;
    try {
      const lalaText = lalaResponse.content[0].text.trim();
      lalaBeats = JSON.parse(lalaText);
    } catch (parseErr) {
      console.error('Lala parse error:', parseErr.message);
      return res.status(500).json({ error: 'Failed to parse Lala beats from Claude' });
    }

    // ── Pipeline 3: Assemble final script ────────────────────────────────
    const scriptResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: buildScriptPrompt(jlawBeats, lalaBeats, context),
      }],
    });

    const script = scriptResponse.content[0].text.trim();

    // ── Response ─────────────────────────────────────────────────────────
    res.json({
      script,
      beat_count: jlawBeats.length + lalaBeats.length,
      jlaw_beats: jlawBeats,
      lala_beats: lalaBeats,
      source_lines: approvedLines.map(l => ({
        id:      l.id,
        content: l.text,
        status:  l.status,
      })),
      meta: {
        book_title:    book.title,
        chapter_title: chapter.title,
        event_name,
        episode_arc,
        pnos_act,
        pnos_belief,
        jlaw_arc:   `${pnos_act} — ${episode_arc}`,
        lala_tone:  toneDescription(lala_tone),
        lines_used: approvedLines.length,
      },
    });

  } catch (err) {
    console.error('generate-script-from-book error:', err);
    res.status(500).json({ error: err.message || 'Script generation failed' });
  }
});

module.exports = router;

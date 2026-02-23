'use strict';

const express    = require('express');
const router     = express.Router();

// ── 1. Lala Detection Logic ────────────────────────────────────────────────

function detectLalaLine(text) {
  if (!text || typeof text !== 'string') return false;

  const t = text.trim();
  if (t.length === 0) return false;

  // Hard signals — explicit attribution patterns
  const hardSignals = [
    /\bLala\b/i,
    /\bshe said\b.*\bconfident/i,
    /\bher voice\b.*\bcalm/i,
  ];
  for (const pattern of hardSignals) {
    if (pattern.test(t)) return true;
  }

  // Tonal rupture signals
  const tonalSignals = [
    /^(You\s+(could|should|will|are|have|know|don't|didn't|never|always))/i,
    /^(She\s+already\s+knew)/i,
    /^(That\s+was\s+the\s+(moment|answer|truth|point))/i,
    /^(Not\s+because|Not\s+yet|Not\s+anymore|Not\s+her)\b/i,
    /\bLala\b/,
  ];

  for (const pattern of tonalSignals) {
    if (pattern.test(t)) return true;
  }

  return false;
}

function detectLalaFromLine(line) {
  if (!line) return false;

  const tags = line.source_tags || {};
  if (
    tags.lala === true ||
    tags.suggestion_type === 'lala' ||
    line.source_type === 'lala'
  ) return true;

  const text = line.content || line.text || '';
  return detectLalaLine(text);
}

async function logLalaEmergence(db, params) {
  const {
    lineId,
    chapterId,
    bookId,
    lineContent,
    lineOrder        = null,
    chapterTitle     = null,
    emotionalContext = null,
    detectionMethod  = 'auto',
  } = params;

  const { LalaEmergenceScene } = db;
  if (!LalaEmergenceScene) {
    console.warn('LalaEmergenceScene model not found — skipping lala scene log');
    return null;
  }

  try {
    const [scene, created] = await LalaEmergenceScene.findOrCreate({
      where: { line_id: lineId },
      defaults: {
        chapter_id:        chapterId,
        book_id:           bookId,
        line_content:      lineContent,
        line_order:        lineOrder,
        chapter_title:     chapterTitle,
        emotional_context: emotionalContext,
        scene_type:        'lala_emergence',
        confirmed:         false,
        canon_tier:        'proto',
        detection_method:  detectionMethod,
        franchise_anchor:  false,
      },
    });

    if (created) {
      console.log(`✦ Lala emergence logged — line ${lineOrder} in "${chapterTitle}" (${lineId})`);
    }

    return { scene, created };
  } catch (err) {
    console.error('logLalaEmergence error:', err.message);
    return null;
  }
}

// ── 2. Routes ──────────────────────────────────────────────────────────────

let optionalAuth;
try {
  const authModule = require('../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
} catch (e) {
  optionalAuth = (req, res, next) => next();
}

/**
 * GET /api/v1/lala-scenes/book/:bookId
 */
router.get('/book/:bookId', optionalAuth, async (req, res) => {
  try {
    const db  = req.app.get('db') || require('../models');
    const { LalaEmergenceScene } = db;

    const scenes = await LalaEmergenceScene.findAll({
      where: { book_id: req.params.bookId },
      order: [['line_order', 'ASC'], ['created_at', 'ASC']],
    });

    res.json({
      scenes:      scenes.map(s => s.toJSON()),
      total:       scenes.length,
      confirmed:   scenes.filter(s => s.confirmed).length,
      unconfirmed: scenes.filter(s => !s.confirmed).length,
    });
  } catch (err) {
    console.error('GET /lala-scenes/book error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/v1/lala-scenes/:sceneId
 */
router.put('/:sceneId', optionalAuth, async (req, res) => {
  try {
    const db  = req.app.get('db') || require('../models');
    const { LalaEmergenceScene } = db;

    const scene = await LalaEmergenceScene.findByPk(req.params.sceneId);
    if (!scene) return res.status(404).json({ error: 'Scene not found' });

    const { confirmed, notes, canon_tier, franchise_anchor, emotional_context } = req.body;
    const updates = {};
    if (confirmed         !== undefined) updates.confirmed          = confirmed;
    if (notes             !== undefined) updates.notes              = notes;
    if (canon_tier        !== undefined) updates.canon_tier         = canon_tier;
    if (franchise_anchor  !== undefined) updates.franchise_anchor   = franchise_anchor;
    if (emotional_context !== undefined) updates.emotional_context  = emotional_context;

    await scene.update(updates);

    res.json({ success: true, scene: scene.toJSON() });
  } catch (err) {
    console.error('PUT /lala-scenes error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/lala-scenes/backfill/:bookId
 */
router.post('/backfill/:bookId', optionalAuth, async (req, res) => {
  try {
    const db = req.app.get('db') || require('../models');
    const {
      LalaEmergenceScene,
      StorytellerBook,
      StorytellerChapter,
      StorytellerLine,
    } = db;

    const book = await StorytellerBook.findByPk(req.params.bookId, {
      include: [{
        model:   StorytellerChapter,
        as:      'chapters',
        include: [{
          model: StorytellerLine,
          as:    'lines',
        }],
      }],
    });

    if (!book) return res.status(404).json({ error: 'Book not found' });

    let scanned  = 0;
    let detected = 0;
    let logged   = 0;

    const results = [];

    for (const chapter of (book.chapters || []).sort((a, b) => (a.order_index || 0) - (b.order_index || 0))) {
      const lines = (chapter.lines || chapter.storyteller_lines || [])
        .filter(l => ['approved', 'edited'].includes(l.status))
        .sort((a, b) => (a.order_index || a.sort_order || 0) - (b.order_index || b.sort_order || 0));

      for (const line of lines) {
        scanned++;

        if (!detectLalaFromLine(line)) continue;
        detected++;

        const result = await logLalaEmergence(db, {
          lineId:          line.id,
          chapterId:       chapter.id,
          bookId:          book.id,
          lineContent:     line.content || line.text || '',
          lineOrder:       line.order_index || line.sort_order || 0,
          chapterTitle:    chapter.title,
          emotionalContext: null,
          detectionMethod: 'backfill',
        });

        if (result?.created) {
          logged++;
          results.push({
            line_id:       line.id,
            chapter_title: chapter.title,
            line_order:    line.order_index || line.sort_order,
            content_preview: (line.content || line.text || '').slice(0, 80),
          });
        }
      }
    }

    res.json({
      success:  true,
      scanned,
      detected,
      logged,
      already_existed: detected - logged,
      results,
    });
  } catch (err) {
    console.error('POST /lala-scenes/backfill error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.detectLalaLine     = detectLalaLine;
module.exports.detectLalaFromLine = detectLalaFromLine;
module.exports.logLalaEmergence   = logLalaEmergence;

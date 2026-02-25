/**
 * StoryTeller Routes
 *
 * GET    /api/v1/storyteller/books              — List all books
 * POST   /api/v1/storyteller/books              — Create a book (with chapters + lines)
 * GET    /api/v1/storyteller/books/:id           — Get book with chapters and lines
 * PUT    /api/v1/storyteller/books/:id           — Update book metadata
 * DELETE /api/v1/storyteller/books/:id           — Delete a book
 * POST   /api/v1/storyteller/books/:id/chapters  — Add a chapter
 * PUT    /api/v1/storyteller/chapters/:id         — Update a chapter
 * DELETE /api/v1/storyteller/chapters/:id         — Delete a chapter
 * POST   /api/v1/storyteller/chapters/:id/lines   — Add a line
 * PUT    /api/v1/storyteller/lines/:id            — Update a line (text, status)
 * DELETE /api/v1/storyteller/lines/:id            — Delete (reject) a line
 * POST   /api/v1/storyteller/books/:id/approve-all — Approve all pending lines
 * POST   /api/v1/storyteller/chapters/:id/import   — Bulk import lines from LINE-marked draft
 *
 * Location: src/routes/storyteller.js
 */

'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { detectLalaFromLine, logLalaEmergence } = require('./lala-scene-detection');

let thresholdDetection;
try {
  thresholdDetection = require('../services/thresholdDetection');
} catch { thresholdDetection = null; }

let emotionalImpact;
try {
  emotionalImpact = require('../services/emotionalImpact');
} catch { emotionalImpact = null; }

// Optional auth
let optionalAuth;
try {
  const authModule = require('../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
} catch (e) {
  optionalAuth = (req, res, next) => next();
}

async function getModels() {
  try { return require('../models'); } catch (e) { return null; }
}


// ═══════════════════════════════════════════
// GET /books — List all books
// ═══════════════════════════════════════════
router.get('/books', optionalAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models?.StorytellerBook) return res.status(500).json({ error: 'Models not loaded' });

    const { show_id } = req.query;
    const where = show_id ? { show_id } : {};

    const books = await models.StorytellerBook.findAll({
      where,
      include: [
        {
          model: models.StorytellerChapter,
          as: 'chapters',
          attributes: ['id', 'title'],
          include: [{
            model: models.StorytellerLine,
            as: 'lines',
            attributes: ['id', 'status', 'text', 'updated_at'],
          }],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    const result = books.map(b => {
      const bj = b.toJSON();
      const allLines = (bj.chapters || []).flatMap(c => c.lines || []);
      const approvedLines = allLines.filter(l => l.status === 'approved');
      const pendingLines = allLines.filter(l => l.status === 'pending');
      const editedLines = allLines.filter(l => l.status === 'edited');

      // Find most recently updated approved line as "recent insight"
      const recentInsight = approvedLines
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];

      // Find the last chapter with content
      const chaptersWithLines = (bj.chapters || []).filter(c => (c.lines || []).length > 0);
      const lastChapter = chaptersWithLines[chaptersWithLines.length - 1];

      return {
        ...bj,
        chapter_count: (bj.chapters || []).length,
        line_count: allLines.length,
        pending_count: pendingLines.length,
        approved_count: approvedLines.length,
        edited_count: editedLines.length,
        recent_insight: recentInsight ? recentInsight.text : null,
        last_chapter_title: lastChapter ? lastChapter.title : null,
        chapters: undefined, // Strip nested chapters from list
      };
    });

    return res.json({ success: true, books: result });
  } catch (error) {
    console.error('StoryTeller list books error:', error);
    return res.status(500).json({ error: 'Failed to list books', message: error.message });
  }
});


// ═══════════════════════════════════════════
// POST /books — Create a book
// ═══════════════════════════════════════════
router.post('/books', optionalAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models?.StorytellerBook) return res.status(500).json({ error: 'Models not loaded' });

    const {
      show_id,
      character_name,
      season_label,
      week_label,
      title,
      subtitle,
      description,
      series_id,
      era_name,
      era_description,
      primary_pov,
      timeline_position,
      canon_status,
      status: reqStatus,
      chapters = [],
    } = req.body;

    if (!title && !character_name) return res.status(400).json({ error: 'title is required' });

    const book = await models.StorytellerBook.create({
      id: uuidv4(),
      show_id: show_id || null,
      character_name: character_name || null,
      season_label: season_label || null,
      week_label: week_label || null,
      title: title || character_name,
      subtitle: subtitle || null,
      description: description || null,
      series_id: series_id || null,
      era_name: era_name || null,
      era_description: era_description || null,
      primary_pov: primary_pov || null,
      timeline_position: timeline_position || null,
      canon_status: canon_status || 'draft',
      status: reqStatus || 'draft',
      compiled_at: new Date(),
    });

    // Create chapters + lines if provided
    for (let ci = 0; ci < chapters.length; ci++) {
      const ch = chapters[ci];
      const chapter = await models.StorytellerChapter.create({
        id: uuidv4(),
        book_id: book.id,
        chapter_number: ch.chapter_number || ci + 1,
        title: ch.title || `Chapter ${ci + 1}`,
        badge: ch.badge || null,
        sort_order: ci,
      });

      const lines = ch.lines || [];
      for (let li = 0; li < lines.length; li++) {
        const ln = lines[li];
        await models.StorytellerLine.create({
          id: uuidv4(),
          chapter_id: chapter.id,
          group_label: ln.group_label || null,
          text: ln.text,
          status: ln.status || 'pending',
          source_tags: ln.source_tags || null,
          confidence: ln.confidence || null,
          sort_order: li,
        });
      }
    }

    // Fetch full book w/ children
    const fullBook = await models.StorytellerBook.findByPk(book.id, {
      include: [{
        model: models.StorytellerChapter, as: 'chapters',
        include: [{ model: models.StorytellerLine, as: 'lines', order: [['sort_order', 'ASC']] }],
        order: [['sort_order', 'ASC']],
      }],
      order: [
        [{ model: models.StorytellerChapter, as: 'chapters' }, 'sort_order', 'ASC'],
        [{ model: models.StorytellerChapter, as: 'chapters' }, { model: models.StorytellerLine, as: 'lines' }, 'sort_order', 'ASC'],
      ],
    });

    return res.status(201).json({ success: true, book: fullBook });
  } catch (error) {
    console.error('StoryTeller create book error:', error);
    return res.status(500).json({ error: 'Failed to create book', message: error.message });
  }
});


// ═══════════════════════════════════════════
// GET /books/:id — Get book with all chapters and lines
// ═══════════════════════════════════════════
router.get('/books/:id', optionalAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models?.StorytellerBook) return res.status(500).json({ error: 'Models not loaded' });

    const book = await models.StorytellerBook.findByPk(req.params.id, {
      include: [{
        model: models.StorytellerChapter, as: 'chapters',
        include: [{ model: models.StorytellerLine, as: 'lines' }],
      }],
      order: [
        [{ model: models.StorytellerChapter, as: 'chapters' }, 'sort_order', 'ASC'],
        [{ model: models.StorytellerChapter, as: 'chapters' }, { model: models.StorytellerLine, as: 'lines' }, 'sort_order', 'ASC'],
      ],
    });

    if (!book) return res.status(404).json({ error: 'Book not found' });

    return res.json({ success: true, book });
  } catch (error) {
    console.error('StoryTeller get book error:', error);
    return res.status(500).json({ error: 'Failed to get book', message: error.message });
  }
});


// ═══════════════════════════════════════════
// PUT /books/:id — Update book metadata
// ═══════════════════════════════════════════
router.put('/books/:id', optionalAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models?.StorytellerBook) return res.status(500).json({ error: 'Models not loaded' });

    const book = await models.StorytellerBook.findByPk(req.params.id);
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const allowed = ['character_name', 'season_label', 'week_label', 'title', 'subtitle', 'status', 'description', 'series_id', 'era_name', 'era_description', 'primary_pov', 'timeline_position', 'canon_status'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    await book.update(updates);
    return res.json({ success: true, book });
  } catch (error) {
    console.error('StoryTeller update book error:', error);
    return res.status(500).json({ error: 'Failed to update book', message: error.message });
  }
});


// ═══════════════════════════════════════════
// DELETE /books/:id — Delete a book
// ═══════════════════════════════════════════
router.delete('/books/:id', optionalAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models?.StorytellerBook) return res.status(500).json({ error: 'Models not loaded' });

    const book = await models.StorytellerBook.findByPk(req.params.id);
    if (!book) return res.status(404).json({ error: 'Book not found' });

    await book.destroy();
    return res.json({ success: true, message: 'Book deleted' });
  } catch (error) {
    console.error('StoryTeller delete book error:', error);
    return res.status(500).json({ error: 'Failed to delete book', message: error.message });
  }
});


// ═══════════════════════════════════════════
// POST /books/:id/chapters — Add a chapter
// ═══════════════════════════════════════════
router.post('/books/:id/chapters', optionalAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models?.StorytellerChapter) return res.status(500).json({ error: 'Models not loaded' });

    const book = await models.StorytellerBook.findByPk(req.params.id);
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const { chapter_number, title, badge, lines = [] } = req.body;

    // Get next sort_order
    const maxOrder = await models.StorytellerChapter.max('sort_order', { where: { book_id: book.id } });

    const chapter = await models.StorytellerChapter.create({
      id: uuidv4(),
      book_id: book.id,
      chapter_number: chapter_number || (maxOrder || 0) + 1,
      title: title || `Chapter ${(maxOrder || 0) + 1}`,
      badge: badge || null,
      sort_order: (maxOrder || 0) + 1,
    });

    for (let li = 0; li < lines.length; li++) {
      const ln = lines[li];
      await models.StorytellerLine.create({
        id: uuidv4(),
        chapter_id: chapter.id,
        group_label: ln.group_label || null,
        text: ln.text,
        status: ln.status || 'pending',
        source_tags: ln.source_tags || null,
        confidence: ln.confidence || null,
        sort_order: li,
      });
    }

    const fullChapter = await models.StorytellerChapter.findByPk(chapter.id, {
      include: [{ model: models.StorytellerLine, as: 'lines' }],
      order: [[{ model: models.StorytellerLine, as: 'lines' }, 'sort_order', 'ASC']],
    });

    return res.status(201).json({ success: true, chapter: fullChapter });
  } catch (error) {
    console.error('StoryTeller add chapter error:', error);
    return res.status(500).json({ error: 'Failed to add chapter', message: error.message });
  }
});


// ═══════════════════════════════════════════
// PUT /chapters/:id — Update a chapter
// ═══════════════════════════════════════════
router.put('/chapters/:id', optionalAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models?.StorytellerChapter) return res.status(500).json({ error: 'Models not loaded' });

    const chapter = await models.StorytellerChapter.findByPk(req.params.id);
    if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

    const allowed = ['chapter_number', 'title', 'badge', 'sort_order',
      'primary_character_id', 'characters_present', 'pov',
      'scene_goal', 'emotional_state_start', 'emotional_state_end',
      'theme', 'chapter_notes', 'interview_answers'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    await chapter.update(updates);
    return res.json({ success: true, chapter });
  } catch (error) {
    console.error('StoryTeller update chapter error:', error);
    return res.status(500).json({ error: 'Failed to update chapter', message: error.message });
  }
});


// ═══════════════════════════════════════════
// DELETE /chapters/:id — Delete a chapter
// ═══════════════════════════════════════════
router.delete('/chapters/:id', optionalAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models?.StorytellerChapter) return res.status(500).json({ error: 'Models not loaded' });

    const chapter = await models.StorytellerChapter.findByPk(req.params.id);
    if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

    await chapter.destroy();
    return res.json({ success: true, message: 'Chapter deleted' });
  } catch (error) {
    console.error('StoryTeller delete chapter error:', error);
    return res.status(500).json({ error: 'Failed to delete chapter', message: error.message });
  }
});


// ═══════════════════════════════════════════
// POST /chapters/:id/lines — Add a line
// ═══════════════════════════════════════════
router.post('/chapters/:id/lines', optionalAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models?.StorytellerLine) return res.status(500).json({ error: 'Models not loaded' });

    const chapter = await models.StorytellerChapter.findByPk(req.params.id);
    if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

    const { group_label, text, status, source_tags, confidence } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    const maxOrder = await models.StorytellerLine.max('sort_order', { where: { chapter_id: chapter.id } });

    const line = await models.StorytellerLine.create({
      id: uuidv4(),
      chapter_id: chapter.id,
      group_label: group_label || null,
      text,
      status: status || 'pending',
      source_tags: source_tags || null,
      confidence: confidence || null,
      sort_order: (maxOrder || 0) + 1,
    });

    return res.status(201).json({ success: true, line });
  } catch (error) {
    console.error('StoryTeller add line error:', error);
    return res.status(500).json({ error: 'Failed to add line', message: error.message });
  }
});


// ═══════════════════════════════════════════
// PUT /lines/:id — Update a line
// ═══════════════════════════════════════════
router.put('/lines/:id', optionalAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models?.StorytellerLine) return res.status(500).json({ error: 'Models not loaded' });

    const line = await models.StorytellerLine.findByPk(req.params.id);
    if (!line) return res.status(404).json({ error: 'Line not found' });

    const { text, status, group_label, source_tags, confidence } = req.body;
    const updates = {};

    if (text !== undefined) {
      // Save original if this is the first edit
      if (!line.original_text) {
        updates.original_text = line.text;
      }
      updates.text = text;
      updates.edited_at = new Date();
      if (!status) updates.status = 'edited';
    }
    if (status !== undefined) updates.status = status;
    if (group_label !== undefined) updates.group_label = group_label;
    if (source_tags !== undefined) updates.source_tags = source_tags;
    if (confidence !== undefined) updates.confidence = confidence;

    await line.update(updates);

    // ── Lala Emergence hook — detect after approval/edit ──
    if (updates.status === 'approved' || updates.status === 'edited') {
      try {
        const updatedLine = line.toJSON();
        if (detectLalaFromLine(updatedLine)) {
          const chapter = await models.StorytellerChapter.findByPk(line.chapter_id);
          await logLalaEmergence(models, {
            lineId:          line.id,
            chapterId:       line.chapter_id,
            bookId:          chapter?.book_id,
            lineContent:     updatedLine.text || '',
            lineOrder:       updatedLine.sort_order || 0,
            chapterTitle:    chapter?.title || null,
            emotionalContext: null,
            detectionMethod: 'approval',
          });
        }
      } catch (lalaErr) {
        console.error('Lala detection hook error (non-fatal):', lalaErr.message);
      }
    }

    // ── Threshold Detection hook — check wound thresholds after approval ──
    if (thresholdDetection && (updates.status === 'approved' || updates.status === 'edited')) {
      thresholdDetection.checkAllThresholds(models).catch(e =>
        console.error('Threshold detection (line-approval):', e.message)
      );
    }

    return res.json({ success: true, line });
  } catch (error) {
    console.error('StoryTeller update line error:', error);
    return res.status(500).json({ error: 'Failed to update line', message: error.message });
  }
});


// ═══════════════════════════════════════════
// DELETE /chapters/:id/lines — Clear all lines from a chapter
// ═══════════════════════════════════════════
router.delete('/chapters/:id/lines', optionalAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models?.StorytellerLine || !models?.StorytellerChapter) return res.status(500).json({ error: 'Models not loaded' });

    const chapter = await models.StorytellerChapter.findByPk(req.params.id);
    if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

    const count = await models.StorytellerLine.destroy({ where: { chapter_id: chapter.id } });
    return res.json({ success: true, message: `Cleared ${count} lines from chapter`, count });
  } catch (error) {
    console.error('StoryTeller clear chapter error:', error);
    return res.status(500).json({ error: 'Failed to clear chapter', message: error.message });
  }
});


// ═══════════════════════════════════════════
// DELETE /lines/:id — Reject/remove a line
// ═══════════════════════════════════════════
router.delete('/lines/:id', optionalAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models?.StorytellerLine) return res.status(500).json({ error: 'Models not loaded' });

    const line = await models.StorytellerLine.findByPk(req.params.id);
    if (!line) return res.status(404).json({ error: 'Line not found' });

    await line.destroy();
    return res.json({ success: true, message: 'Line removed' });
  } catch (error) {
    console.error('StoryTeller delete line error:', error);
    return res.status(500).json({ error: 'Failed to delete line', message: error.message });
  }
});


// ═══════════════════════════════════════════
// POST /books/:id/approve-all — Approve all pending lines
// ═══════════════════════════════════════════
router.post('/books/:id/approve-all', optionalAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models?.StorytellerBook) return res.status(500).json({ error: 'Models not loaded' });

    const book = await models.StorytellerBook.findByPk(req.params.id, {
      include: [{
        model: models.StorytellerChapter, as: 'chapters',
        include: [{ model: models.StorytellerLine, as: 'lines' }],
      }],
    });

    if (!book) return res.status(404).json({ error: 'Book not found' });

    let approvedCount = 0;
    for (const chapter of book.chapters) {
      for (const line of chapter.lines) {
        if (line.status === 'pending') {
          await line.update({ status: 'approved' });
          approvedCount++;
        }
      }
    }

    return res.json({
      success: true,
      approved_count: approvedCount,
      message: `${approvedCount} line${approvedCount !== 1 ? 's' : ''} approved`,
    });
  } catch (error) {
    console.error('StoryTeller approve all error:', error);
    return res.status(500).json({ error: 'Failed to approve all', message: error.message });
  }
});


// ═══════════════════════════════════════════
// POST /chapters/:chapterId/import — Bulk import lines from LINE-marked draft
// ═══════════════════════════════════════════
router.post('/chapters/:chapterId/import', optionalAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models?.StorytellerLine || !models?.StorytellerChapter) {
      return res.status(500).json({ error: 'Models not loaded' });
    }

    const { chapterId } = req.params;
    const { raw_text, mode = 'append' } = req.body;

    if (!raw_text?.trim()) {
      return res.status(400).json({ error: 'raw_text is required' });
    }

    // Verify chapter exists
    const chapter = await models.StorytellerChapter.findByPk(chapterId);
    if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

    // Parse lines from raw text
    const parsedLines = parseImportText(raw_text);
    if (parsedLines.length === 0) {
      return res.status(400).json({
        error: 'No lines found. Make sure your text contains LINE NNN markers.',
      });
    }

    // Replace mode: delete existing lines
    if (mode === 'replace') {
      await models.StorytellerLine.destroy({ where: { chapter_id: chapterId } });
    }

    // Get current max sort_order for append mode
    let startIndex = 0;
    if (mode === 'append') {
      const maxLine = await models.StorytellerLine.findOne({
        where: { chapter_id: chapterId },
        order: [['sort_order', 'DESC']],
      });
      startIndex = maxLine ? maxLine.sort_order + 1 : 0;
    }

    // Bulk create lines
    const toCreate = parsedLines.map((line, i) => ({
      id: uuidv4(),
      chapter_id: chapterId,
      text: line.content,
      group_label: line.label || null,
      status: 'pending',
      sort_order: startIndex + i,
    }));

    const created = await models.StorytellerLine.bulkCreate(toCreate, {
      returning: true,
    });

    return res.status(201).json({
      imported: created.length,
      skipped: 0,
      lines: created,
    });
  } catch (err) {
    console.error('POST /chapters/:chapterId/import error:', err);
    return res.status(500).json({ error: err.message });
  }
});


// ── Import parser ──────────────────────────────────────────────────────────

function parseImportText(rawText) {
  const lines = rawText.split('\n');
  const results = [];

  const lineMarker = /^LINE\s+(\d+)(?:\s+\[([^\]]*)\])?\s*$/i;
  const skipPatterns = [
    /^---+$/,
    /^CHAPTER\s+/i,
    /^END\s+CHAPTER/i,
    /^Theme:/i,
    /^POV:/i,
    /^Era:/i,
    /^Status:/i,
    /^Word count/i,
    /^Lines:/i,
    /^Memory candidates/i,
    /^POV breakdown/i,
    /^\s*$/,
  ];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (skipPatterns.some(p => p.test(line))) { i++; continue; }

    const match = line.match(lineMarker);
    if (match) {
      const label = `line-${match[1]}`;
      i++;
      while (i < lines.length && lines[i].trim() === '') i++;
      if (i < lines.length) {
        const content = lines[i].trim();
        if (content && !skipPatterns.some(p => p.test(content))) {
          results.push({ label, content });
        }
      }
      i++;
      continue;
    }
    i++;
  }

  return results;
}


// ═══════════════════════════════════════════════════════
// ECHO ROUTES — Decision Echo CRUD
// ═══════════════════════════════════════════════════════

// POST /echoes — Plant an echo
router.post('/echoes', optionalAuth, async (req, res) => {
  try {
    const db = await getModels();
    if (!db?.StorytellerEcho) return res.status(500).json({ error: 'Echo model not loaded' });

    const {
      book_id, source_chapter_id, source_line_id,
      source_line_content, target_chapter_id, note,
      landing_note, status = 'planted',
    } = req.body;

    if (!book_id || !note) {
      return res.status(400).json({ error: 'book_id and note are required' });
    }

    const echo = await db.StorytellerEcho.create({
      book_id, source_chapter_id, source_line_id,
      source_line_content, target_chapter_id, note,
      landing_note, status,
    });

    res.status(201).json(echo);
  } catch (err) {
    console.error('POST /echoes error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /echoes?book_id=...&target_chapter_id=... — Get echoes for a book (optionally filtered by target chapter)
router.get('/echoes', optionalAuth, async (req, res) => {
  try {
    const db = await getModels();
    if (!db?.StorytellerEcho) return res.status(500).json({ error: 'Echo model not loaded' });

    const where = {};
    if (req.query.book_id) where.book_id = req.query.book_id;
    if (req.query.target_chapter_id) where.target_chapter_id = req.query.target_chapter_id;
    if (req.query.status) where.status = req.query.status;

    const echoes = await db.StorytellerEcho.findAll({
      where,
      order: [['created_at', 'DESC']],
    });

    res.json(echoes);
  } catch (err) {
    console.error('GET /echoes error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /echoes/:echoId — Update an echo (e.g., mark as landed)
router.put('/echoes/:echoId', optionalAuth, async (req, res) => {
  try {
    const db = await getModels();
    if (!db?.StorytellerEcho) return res.status(500).json({ error: 'Echo model not loaded' });

    const echo = await db.StorytellerEcho.findByPk(req.params.echoId);
    if (!echo) return res.status(404).json({ error: 'Echo not found' });

    const allowed = ['note', 'landing_note', 'status', 'target_chapter_id'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) echo[key] = req.body[key];
    }
    await echo.save();

    res.json(echo);
  } catch (err) {
    console.error('PUT /echoes/:echoId error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /echoes/:echoId — Delete an echo
router.delete('/echoes/:echoId', optionalAuth, async (req, res) => {
  try {
    const db = await getModels();
    if (!db?.StorytellerEcho) return res.status(500).json({ error: 'Echo model not loaded' });

    const echo = await db.StorytellerEcho.findByPk(req.params.echoId);
    if (!echo) return res.status(404).json({ error: 'Echo not found' });

    await echo.destroy();
    res.json({ deleted: true, id: req.params.echoId });
  } catch (err) {
    console.error('DELETE /echoes/:echoId error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════
// POST /chapters/:chapterId/save-draft — Save draft prose without splitting into lines
// ═══════════════════════════════════════════
router.post('/chapters/:chapterId/save-draft', optionalAuth, async (req, res) => {
  try {
    const { chapterId } = req.params;
    const { draft_prose } = req.body;

    if (!draft_prose) {
      return res.status(400).json({ error: 'draft_prose required' });
    }

    const models = await getModels();
    if (!models?.StorytellerChapter) {
      return res.status(500).json({ error: 'Models not loaded' });
    }

    await models.StorytellerChapter.update(
      { draft_prose },
      { where: { id: chapterId } }
    );

    res.json({ ok: true });

  } catch (err) {
    console.error('POST /chapters/:id/save-draft error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════
// POST /chapters/:id/emotional-impact — Analyze prose impact on character
// ═══════════════════════════════════════════
// Called when prose is sent to review from WriteMode.
// The system reads what happened to the character in the scene
// and shifts their emotional state accordingly.
// If thresholds cross — the character knocks. You get the email.
router.post('/chapters/:id/emotional-impact', optionalAuth, async (req, res) => {
  try {
    const { prose, character_id } = req.body;
    const chapterId = req.params.id;

    if (!prose || !character_id) {
      return res.json({ skipped: true, reason: 'No prose or character_id provided' });
    }

    if (!emotionalImpact) {
      return res.json({ skipped: true, reason: 'Emotional impact service not available' });
    }

    const result = await emotionalImpact.processChapterProse({
      prose,
      characterId: character_id,
      chapterId,
    });

    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('POST /chapters/:id/emotional-impact error:', err);
    // Non-fatal — never block the writing flow
    return res.json({ skipped: true, reason: err.message });
  }
});


module.exports = router;

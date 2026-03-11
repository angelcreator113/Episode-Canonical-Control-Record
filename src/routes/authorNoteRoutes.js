'use strict';
/**
 * authorNoteRoutes.js — The Author Layer
 * ─────────────────────────────────────────────────────────────────────────────
 * Mount in app.js:
 *   app.use('/api/v1/author-notes', authorNoteRoutes);
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * GET    /?entity_type=&entity_id=   — list notes; exclude private from Amber
 * POST   /                            — create; enforce: private → visible_to_amber=false
 * PUT    /:id                         — update text or type
 * DELETE /:id                         — delete
 */
const express = require('express');
const router  = express.Router();
const { optionalAuth } = require('../middleware/auth');

router.use(optionalAuth);

function getModels(req) {
  return req.app.get('models') || require('../models');
}

// GET /
router.get('/', async (req, res) => {
  const { AuthorNote } = getModels(req);
  try {
    const { entity_type, entity_id, viewer } = req.query;
    if (!entity_type || !entity_id) {
      return res.status(400).json({ error: 'entity_type and entity_id required' });
    }

    const where = { entity_type, entity_id };
    // If Amber is viewing, exclude private notes
    if (viewer === 'amber') {
      where.visible_to_amber = true;
    }

    const notes = await AuthorNote.findAll({
      where,
      order: [['created_at', 'DESC']],
    });
    res.json({ notes });
  } catch (err) {
    console.error('[AuthorNotes] GET / error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /
router.post('/', async (req, res) => {
  const { AuthorNote } = getModels(req);
  try {
    const { entity_type, entity_id, note_text, note_type, created_by } = req.body;
    if (!entity_type || !entity_id || !note_text || !note_type || !created_by) {
      return res.status(400).json({ error: 'entity_type, entity_id, note_text, note_type, and created_by required' });
    }

    // RULE: private → visible_to_amber ALWAYS false
    const visible_to_amber = note_type === 'private' ? false : (req.body.visible_to_amber !== false);

    const note = await AuthorNote.create({
      entity_type, entity_id, note_text, note_type,
      visible_to_amber,
      created_by,
    });
    res.status(201).json({ note });
  } catch (err) {
    console.error('[AuthorNotes] POST / error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id
router.put('/:id', async (req, res) => {
  const { AuthorNote } = getModels(req);
  try {
    const note = await AuthorNote.findByPk(req.params.id);
    if (!note) return res.status(404).json({ error: 'Note not found' });

    const updates = {};
    if (req.body.note_text !== undefined) updates.note_text = req.body.note_text;
    if (req.body.note_type !== undefined) {
      updates.note_type = req.body.note_type;
      // Re-enforce private rule on type change
      if (req.body.note_type === 'private') {
        updates.visible_to_amber = false;
      }
    }
    await note.update(updates);
    res.json({ note });
  } catch (err) {
    console.error('[AuthorNotes] PUT /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  const { AuthorNote } = getModels(req);
  try {
    const note = await AuthorNote.findByPk(req.params.id);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    await note.destroy();
    res.json({ success: true, message: 'Note deleted' });
  } catch (err) {
    console.error('[AuthorNotes] DELETE /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

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
// Supports two query modes:
//   1. entity_type + entity_id → notes for a specific entity
//   2. note_type (optionally + entity_type) → actionable notes across entities (Dashboard use)
router.get('/', async (req, res) => {
  const { AuthorNote } = getModels(req);
  try {
    const { entity_type, entity_id, note_type, viewer, limit } = req.query;

    const where = {};
    if (entity_type) where.entity_type = entity_type;
    if (entity_id)   where.entity_id   = entity_id;
    if (note_type)   where.note_type   = note_type;
    // If Amber is viewing, exclude private notes
    if (viewer === 'amber') {
      where.visible_to_amber = true;
    }

    // Require at least one filter to prevent unbounded queries
    if (Object.keys(where).length === 0) {
      return res.status(400).json({ error: 'At least one filter required (entity_type, entity_id, or note_type)' });
    }

    const notes = await AuthorNote.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: limit ? parseInt(limit, 10) : 50,
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

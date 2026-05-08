'use strict';

/**
 * Arc Routes
 * Mount at: /api/v1
 *
 * GET    /world/:showId/arc              — Get active arc with phases, debt, temperature
 * POST   /world/:showId/arc/seed         — Seed Arc 1 with 3 phases
 * POST   /world/:showId/arc/advance      — Manual phase advance (with warning)
 * POST   /world/:showId/arc/advance/confirm — Force advance after warning acknowledged
 * GET    /world/:showId/arc/context      — Get arc context for AI prompt injection
 * PUT    /world/:showId/arc/phase/:phase — Update phase settings (override feed behavior, etc.)
 * POST   /world/:showId/arc/extend       — Extend current phase (delay transition)
 */

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');

// GET /world/:showId/arc — active arc
router.get('/world/:showId/arc', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { showId } = req.params;

    const [arcs] = await models.sequelize.query(
      `SELECT * FROM show_arcs WHERE show_id = :showId AND deleted_at IS NULL
       ORDER BY arc_number ASC`,
      { replacements: { showId } }
    );

    if (!arcs?.length) {
      return res.json({ success: true, arc: null, message: 'No arc found. Seed one first.' });
    }

    const arc = arcs.find(a => a.status === 'active') || arcs[0];
    const phases = typeof arc.phases === 'string' ? JSON.parse(arc.phases) : arc.phases;
    const debt = typeof arc.narrative_debt === 'string' ? JSON.parse(arc.narrative_debt) : arc.narrative_debt;
    const log = typeof arc.progression_log === 'string' ? JSON.parse(arc.progression_log) : arc.progression_log;

    return res.json({
      success: true,
      arc: {
        ...arc,
        phases,
        narrative_debt: debt,
        progression_log: log,
        current_phase_detail: phases.find(p => p.phase === arc.current_phase),
      },
    });
  } catch (err) {
    if (err.message?.includes('show_arcs') || err.message?.includes('does not exist')) {
      return res.json({ success: true, arc: null, message: 'Table not created yet. Run migrations.' });
    }
    return res.status(500).json({ error: err.message });
  }
});

// POST /world/:showId/arc/seed — seed Arc 1
router.post('/world/:showId/arc/seed', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { seedArc } = require('../services/arcProgressionService');
    const result = await seedArc(req.params.showId, models);

    if (result.exists) {
      return res.json({ success: true, message: 'Arc 1 already exists.', arc_id: result.arc_id });
    }

    return res.json({
      success: true,
      message: 'Arc 1 seeded with 3 phases: Foundation, Ascension, Legacy.',
      arc_id: result.arc_id,
      phases: result.phases,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /world/:showId/arc/advance — manual advance (returns warning if needed)
router.post('/world/:showId/arc/advance', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { advancePhase } = require('../services/arcProgressionService');
    const { episode_number } = req.body;

    const result = await advancePhase(req.params.showId, models, {
      triggered_by: 'manual',
      force: false,
      episode_number,
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /world/:showId/arc/advance/confirm — force advance after warning
router.post('/world/:showId/arc/advance/confirm', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { advancePhase } = require('../services/arcProgressionService');
    const { episode_number } = req.body;

    const result = await advancePhase(req.params.showId, models, {
      triggered_by: 'manual',
      force: true,
      episode_number,
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /world/:showId/arc/context — for AI prompt injection
router.get('/world/:showId/arc/context', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { getArcContext } = require('../services/arcProgressionService');
    const context = await getArcContext(req.params.showId, models);
    return res.json({ success: true, data: context });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /world/:showId/arc/phase/:phase — override phase settings
router.put('/world/:showId/arc/phase/:phase', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { showId } = req.params;
    const phaseNum = parseInt(req.params.phase);
    const updates = req.body; // { tagline, feed_behavior, emotional_arc, etc. }

    const [arcRows] = await models.sequelize.query(
      `SELECT id, phases FROM show_arcs WHERE show_id = :showId AND status = 'active' AND deleted_at IS NULL LIMIT 1`,
      { replacements: { showId } }
    );
    if (!arcRows?.length) return res.status(404).json({ error: 'No active arc' });

    const arc = arcRows[0];
    const phases = typeof arc.phases === 'string' ? JSON.parse(arc.phases) : [...arc.phases];
    const phaseIdx = phases.findIndex(p => p.phase === phaseNum);
    if (phaseIdx === -1) return res.status(404).json({ error: `Phase ${phaseNum} not found` });

    // Apply updates (only allowed fields)
    const allowed = ['tagline', 'emotional_arc', 'feed_behavior'];
    for (const key of allowed) {
      if (updates[key] !== undefined) phases[phaseIdx][key] = updates[key];
    }

    await models.sequelize.query(
      'UPDATE show_arcs SET phases = :phases, updated_at = NOW() WHERE id = :id',
      { replacements: { phases: JSON.stringify(phases), id: arc.id } }
    );

    return res.json({ success: true, phase: phases[phaseIdx] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /world/:showId/arc/extend — extend current phase by N episodes
router.post('/world/:showId/arc/extend', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { showId } = req.params;
    const { extend_by = 2, reason } = req.body;

    const [arcRows] = await models.sequelize.query(
      `SELECT id, phases, current_phase, progression_log FROM show_arcs
       WHERE show_id = :showId AND status = 'active' AND deleted_at IS NULL LIMIT 1`,
      { replacements: { showId } }
    );
    if (!arcRows?.length) return res.status(404).json({ error: 'No active arc' });

    const arc = arcRows[0];
    const phases = typeof arc.phases === 'string' ? JSON.parse(arc.phases) : [...arc.phases];
    const currentIdx = phases.findIndex(p => p.phase === arc.current_phase);
    const currentPhase = phases[currentIdx];

    const oldEnd = currentPhase.episode_end;
    currentPhase.episode_end += extend_by;

    // Shift subsequent phases
    for (let i = currentIdx + 1; i < phases.length; i++) {
      phases[i].episode_start += extend_by;
      phases[i].episode_end += extend_by;
    }

    // Update arc episode_end
    const newArcEnd = phases[phases.length - 1].episode_end;

    const log = typeof arc.progression_log === 'string' ? JSON.parse(arc.progression_log) : [...(arc.progression_log || [])];
    log.push({
      from_phase: currentPhase.phase, to_phase: currentPhase.phase,
      triggered_by: 'manual',
      trigger_reason: `Phase extended by ${extend_by} episodes: ${reason || 'showrunner decision'}`,
      timestamp: new Date().toISOString(),
    });

    await models.sequelize.query(
      `UPDATE show_arcs SET phases = :phases, episode_end = :arcEnd,
       progression_log = :log, updated_at = NOW() WHERE id = :id`,
      { replacements: {
        phases: JSON.stringify(phases), arcEnd: newArcEnd,
        log: JSON.stringify(log), id: arc.id,
      } }
    );

    return res.json({
      success: true,
      message: `Phase "${currentPhase.title}" extended from episode ${oldEnd} to ${currentPhase.episode_end}`,
      phase: currentPhase,
      arc_episode_end: newArcEnd,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

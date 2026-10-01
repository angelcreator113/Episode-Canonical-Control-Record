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
 * GET    /world/:showId/season/roadmap — The active season's 24 slots and their states (Season Arc A2)
 * PUT    /world/:showId/season/slots/:slotId/event   — Pencil an event into a future slot, or clear it (Q5)
 * PUT    /world/:showId/season/slots/:slotId/episode — Place an existing episode in an open slot (Q4)
 * PUT    /world/:showId/season/slots/:slotId/intention       — Edit a future slot's intention (A3)
 * POST   /world/:showId/season/slots/:slotId/intention/draft — Auto-draft it with AI (A3, Q12)
 *
 * Extend (lengthen the current phase, pushing the season past 24) is removed:
 * "Remove Extend; phase boundaries can shift within the 24, only across slots
 * that haven't started." (Evoni, 2026-10-01, §8(ff) Q2)
 */

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');

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

// GET /world/:showId/season/roadmap — the Season Arc roadmap (§8(ff) A2), read-only
router.get('/world/:showId/season/roadmap', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { getRoadmap } = require('../services/seasonSlotService');
    const roadmap = await getRoadmap(models.sequelize, req.params.showId);
    return res.json({ success: true, roadmap });
  } catch (err) {
    console.error('[ArcRoutes] season roadmap error:', err);
    return res.status(500).json({ error: err.message });
  }
});

function sendSlotError(res, err, label) {
  if (err.status && err.code) return res.status(err.status).json({ error: err.message, code: err.code });
  console.error(`[ArcRoutes] ${label} error:`, err);
  return res.status(500).json({ error: err.message });
}

// PUT /world/:showId/season/slots/:slotId/event — pencil an event in (§8(ff) Q5)
// Body: { event_id } (null clears). Only future slots; the event moves freely.
router.put('/world/:showId/season/slots/:slotId/event', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { pencilEvent } = require('../services/seasonSlotService');
    const eventId = req.body?.event_id || null;
    const result = await pencilEvent(models.sequelize, req.params.showId, req.params.slotId, eventId);
    return res.json({ success: true, ...result });
  } catch (err) {
    return sendSlotError(res, err, 'pencil event');
  }
});

// PUT /world/:showId/season/slots/:slotId/episode — place an existing episode (§8(ff) Q4)
// Body: { episode_id }. Only an open slot; the slot then locks to the episode (A7).
router.put('/world/:showId/season/slots/:slotId/episode', requireAuth, async (req, res) => {
  try {
    const episodeId = req.body?.episode_id;
    if (!episodeId) return res.status(400).json({ error: 'episode_id is required' });
    const models = require('../models');
    const { placeEpisode } = require('../services/seasonSlotService');
    const result = await placeEpisode(models.sequelize, req.params.showId, req.params.slotId, episodeId);
    return res.json({ success: true, ...result });
  } catch (err) {
    return sendSlotError(res, err, 'place episode');
  }
});

// PUT /world/:showId/season/slots/:slotId/intention — edit a future slot's intention (§8(ff) A3)
// Body: { story_purpose, career_focus, desired_pressure, outcome_range: { min, max } }.
router.put('/world/:showId/season/slots/:slotId/intention', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { saveIntention } = require('../services/seasonIntentionService');
    const result = await saveIntention(models.sequelize, req.params.showId, req.params.slotId, req.body || {});
    return res.json({ success: true, ...result });
  } catch (err) {
    return sendSlotError(res, err, 'save intention');
  }
});

// POST /world/:showId/season/slots/:slotId/intention/draft — auto-draft it (§8(ff) A3, Q12)
// Body: { force } replaces an Edited intention (Evoni's confirm).
router.post('/world/:showId/season/slots/:slotId/intention/draft', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const models = require('../models');
    const { draftIntention } = require('../services/seasonIntentionService');
    const result = await draftIntention(models.sequelize, req.params.showId, req.params.slotId, { force: req.body?.force === true });
    return res.json({ success: true, ...result });
  } catch (err) {
    return sendSlotError(res, err, 'draft intention');
  }
});

module.exports = router;

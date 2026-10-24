'use strict';

/**
 * Arc Routes
 * Mount at: /api/v1
 *
 * GET    /world/:showId/arc              — Get the active arc (else the latest) with phases, debt, temperature,
 *                                           and next_season_number for "Start Season N"
 * POST   /world/:showId/arc/seed         — Seed the next season from the "Set up the season" form
 *                                           ({ title, tagline, phases: [{ title, tagline }] x3, split: [n, n, n] })
 * PUT    /world/:showId/arc/setup        — "Edit season": the same form; re-phases slots not started
 * GET    /world/:showId/season/placement — Preview: existing episodes and unused events into open slots
 * POST   /world/:showId/season/placement — Save the preview ({ items: [{ slot_id, episode_id | event_id }] }), one transaction
 * POST   /world/:showId/season/draft     — Draft the season, or one part ({ phase }), in one AI call; nothing saved
 * POST   /world/:showId/season/draft/accept — Save accepted drafts ({ drafts: [...] }) as Auto-drafted intentions
 * POST   /world/:showId/arc/advance      — Manual phase advance (with warning)
 * POST   /world/:showId/arc/advance/confirm — Force advance after warning acknowledged
 * GET    /world/:showId/arc/context      — Get arc context for AI prompt injection
 * PUT    /world/:showId/arc/phase/:phase — Update phase settings (override feed behavior, etc.)
 * GET    /world/:showId/season/roadmap — The active season's 24 slots and their states (Season Arc A2)
 * PUT    /world/:showId/season/slots/:slotId/event   — Pencil an event into a future slot, or clear it (Q5)
 * PUT    /world/:showId/season/slots/:slotId/episode — Place an existing episode in an open slot (Q4)
 * PUT    /world/:showId/season/slots/:slotId/intention       — Edit a future slot's intention (A3)
 * POST   /world/:showId/season/slots/:slotId/intention/draft — Auto-draft it with AI (A3, Q12; a started draft slot from its episode, A9 as changed)
 * GET    /world/:showId/season/event/:eventId — The Event Package's Season Context (A4), read-only
 * GET    /world/:showId/season/threads           — Story threads, with drafts from seeds (Q9)
 * POST   /world/:showId/season/threads           — Create and name a thread (Q9)
 * PUT    /world/:showId/season/threads/:threadId — Rename or re-describe it
 * POST   /world/:showId/season/threads/:threadId/close — Close it (only Evoni closes, Q9)
 * POST   /world/:showId/season/threads/:threadId/reopen — Reopen a closed one, keeping its history
 * GET    /world/:showId/season/insights — Planning Insights: plan beside result, money from the ledger (A8, Q13, Q15)
 * GET    /world/:showId/season/proposals — The open season-arc proposal from the feed, and the last decided (Evoni, 2026-10-17)
 * POST   /world/:showId/season/proposals — Ask for one now (one AI call), even if the feed has not moved
 * POST   /world/:showId/season/proposals/:proposalId/accept  — Apply the chosen changes ({ changes: [indexes] }; all when absent)
 * POST   /world/:showId/season/proposals/:proposalId/dismiss — Dismiss it
 * GET    /world/:showId/season/reveals — The reveal plan (stage E): the season's slots, the show's kept
 *                                         secrets, which secret is hinted or revealed in which slot, and
 *                                         what is wrong with the plan (services/seasonRevealPlan)
 * PUT    /world/:showId/season/reveals — { slot_id, secret_id, intent: hint|reveal, note? }: add or change one
 * DELETE /world/:showId/season/reveals/:revealId — Take it out of the plan
 * GET    /world/:showId/season/twists — Season twists (2026-10-23): each planted in one slot and paid off in a
 *                                        later one, the slots, threads and characters to link, and what is
 *                                        wrong with the list (services/seasonTwists)
 * PUT    /world/:showId/season/twists — { title, description?, plant_slot_id, payoff_slot_id?, status?,
 *                                        thread_ids?, character_ids?, note? }: add one (or change it, with id)
 * PUT    /world/:showId/season/twists/:twistId — Change one
 * DELETE /world/:showId/season/twists/:twistId — Delete it (soft)
 * POST   /world/:showId/season/twists/:twistId/restore — Undo a delete
 * POST   /world/:showId/season/twists/suggest — 3-5 drafted twists from the AI (one call); nothing saved
 * GET    /episodes/:episodeId/season-twists — The twists this episode plants and pays off (the Script tab)
 * POST   /episodes/:episodeId/season-twists/:twistId/mark — { as: planted|paid_off }: Evoni marks it done here
 *
 * Extend (lengthen the current phase, pushing the season past 24) is removed:
 * "Remove Extend; phase boundaries can shift within the 24, only across slots
 * that haven't started." (Evoni, 2026-10-01, §8(ff) Q2)
 */

const express = require('express');
const router = express.Router();

const { requireAuth, authorize } = require('../middleware/auth');
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
      return res.json({ success: true, arc: null, next_season_number: 1, message: 'No arc found. Seed one first.' });
    }

    // The season in progress; else the latest, so a completed season shows "Start Season N".
    const arc = arcs.find(a => a.status === 'active') || arcs[arcs.length - 1];
    const phases = typeof arc.phases === 'string' ? JSON.parse(arc.phases) : arc.phases;
    const debt = typeof arc.narrative_debt === 'string' ? JSON.parse(arc.narrative_debt) : arc.narrative_debt;
    const log = typeof arc.progression_log === 'string' ? JSON.parse(arc.progression_log) : arc.progression_log;

    const nextSeason = Math.max(0, ...arcs.map((a) => Number(a.season_number) || 0)) + 1;
    return res.json({
      success: true,
      next_season_number: nextSeason,
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

// POST /world/:showId/arc/seed — seed the next season from the setup form
// (Evoni, 2026-10-24). An empty body seeds the defaults, as before.
router.post('/world/:showId/arc/seed', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const models = require('../models');
    const { seedArc } = require('../services/arcProgressionService');
    const { normaliseSetup } = require('../services/seasonSetupService');
    const body = req.body || {};
    const setup = Object.keys(body).length ? normaliseSetup(body) : null;
    const result = await seedArc(req.params.showId, models, { setup });

    if (result.exists) {
      return res.status(409).json({
        error: `Season ${result.season_number} is still in progress; finish it before starting the next.`,
        code: 'SEASON_IN_PROGRESS', arc_id: result.arc_id,
      });
    }

    return res.status(201).json({
      success: true,
      message: `Season ${result.season_number} set up with 3 parts.`,
      arc_id: result.arc_id,
      season_number: result.season_number,
      phases: result.phases,
      slots: result.slots,
    });
  } catch (err) {
    return sendSlotError(res, err, 'seed season');
  }
});

// PUT /world/:showId/arc/setup — "Edit season": the setup form again. The split
// re-phases the slots that have not started; a started slot keeps its part.
router.put('/world/:showId/arc/setup', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const models = require('../models');
    const { updateSetup } = require('../services/seasonSetupService');
    const result = await updateSetup(models.sequelize, req.params.showId, req.body || {});
    return res.json({ success: true, ...result });
  } catch (err) {
    return sendSlotError(res, err, 'edit season');
  }
});

// GET /world/:showId/season/placement — the preview of "Use your events and
// episodes"; read-only, nothing is placed until the POST.
router.get('/world/:showId/season/placement', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { previewPlacement } = require('../services/seasonSetupService');
    return res.json({ success: true, ...(await previewPlacement(models.sequelize, req.params.showId)) });
  } catch (err) {
    return sendSlotError(res, err, 'placement preview');
  }
});

// POST /world/:showId/season/placement — Save: { items: [{ slot_id, episode_id | event_id }] }
router.post('/world/:showId/season/placement', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const models = require('../models');
    const { applyPlacement } = require('../services/seasonSetupService');
    return res.json({ success: true, ...(await applyPlacement(models.sequelize, req.params.showId, req.body?.items)) });
  } catch (err) {
    return sendSlotError(res, err, 'apply placement');
  }
});

// POST /world/:showId/season/draft — { phase? }: one AI call drafts the open
// slots; nothing is saved until Evoni accepts.
router.post('/world/:showId/season/draft', requireAuth, authorize(['ADMIN']), aiRateLimiter, async (req, res) => {
  try {
    const models = require('../models');
    const { draftSeason } = require('../services/seasonSetupService');
    const result = await draftSeason(models.sequelize, req.params.showId, { phase: req.body?.phase ?? null });
    return res.json({ success: true, ...result });
  } catch (err) {
    return sendSlotError(res, err, 'draft season');
  }
});

// POST /world/:showId/season/draft/accept — { drafts: [{ slot_id, story_purpose, desired_pressure, story_thread_id }] }
router.post('/world/:showId/season/draft/accept', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const models = require('../models');
    const { acceptDrafts } = require('../services/seasonIntentionService');
    return res.json({ success: true, ...(await acceptDrafts(models.sequelize, req.params.showId, req.body?.drafts)) });
  } catch (err) {
    return sendSlotError(res, err, 'accept season drafts');
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

// GET /world/:showId/season/insights — Planning Insights (§8(ff) A8, Q13,
// Q15), read-only: per slot the plan beside the result, money from the
// ledger with phase totals, the balance trend, the season-health line.
router.get('/world/:showId/season/insights', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { getInsights } = require('../services/planningInsightsService');
    const insights = await getInsights(models.sequelize, req.params.showId);
    return res.json({ success: true, insights });
  } catch (err) {
    console.error('[ArcRoutes] season insights error:', err);
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

// POST /world/:showId/season/slots/:slotId/intention/draft — auto-draft it (§8(ff) A3, Q12).
// A started slot whose episode is a draft is drafted from that episode, never
// over a purpose Evoni edited (A9, as changed 2026-10-01).
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

// GET /world/:showId/season/event/:eventId — the Event Package's read-only
// Season Context block (§8(ff) A4): season, phase, slot and purpose.
router.get('/world/:showId/season/event/:eventId', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { eventSeasonContext } = require('../services/seasonSlotService');
    const context = await eventSeasonContext(models.sequelize, req.params.showId, req.params.eventId);
    return res.json({ success: true, context });
  } catch (err) {
    console.error('[ArcRoutes] event season context error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Story threads (§8(ff) A3, A6, Q9) ─────────────────────────────────────

// GET /world/:showId/season/threads — the show's threads, and drafts from seeds
router.get('/world/:showId/season/threads', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { listThreads, seedDrafts } = require('../services/storyThreadService');
    const threads = await listThreads(models.sequelize, req.params.showId);
    const drafts = await seedDrafts(models.sequelize, req.params.showId);
    return res.json({ success: true, threads, drafts });
  } catch (err) {
    return sendSlotError(res, err, 'list threads');
  }
});

// POST /world/:showId/season/threads — Evoni creates and names a thread
// Body: { title, description, seed_text, episode_id } (seed_text when from a draft).
router.post('/world/:showId/season/threads', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { createThread } = require('../services/storyThreadService');
    const thread = await createThread(models.sequelize, req.params.showId, req.body || {});
    return res.status(201).json({ success: true, thread });
  } catch (err) {
    return sendSlotError(res, err, 'create thread');
  }
});

// PUT /world/:showId/season/threads/:threadId — rename or re-describe
router.put('/world/:showId/season/threads/:threadId', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { updateThread } = require('../services/storyThreadService');
    await updateThread(models.sequelize, req.params.showId, req.params.threadId, req.body || {});
    return res.json({ success: true });
  } catch (err) {
    return sendSlotError(res, err, 'update thread');
  }
});

// POST /world/:showId/season/threads/:threadId/close — only Evoni closes a thread (Q9)
router.post('/world/:showId/season/threads/:threadId/close', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { closeThread } = require('../services/storyThreadService');
    await closeThread(models.sequelize, req.params.showId, req.params.threadId);
    return res.json({ success: true });
  } catch (err) {
    return sendSlotError(res, err, 'close thread');
  }
});

// POST /world/:showId/season/threads/:threadId/reopen — Evoni reopens a closed
// thread, keeping its history (PR 7 choice 1, 2026-10-01)
router.post('/world/:showId/season/threads/:threadId/reopen', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { reopenThread } = require('../services/storyThreadService');
    await reopenThread(models.sequelize, req.params.showId, req.params.threadId);
    return res.json({ success: true });
  } catch (err) {
    return sendSlotError(res, err, 'reopen thread');
  }
});

// ── Season arc proposals from the feed (Evoni, 2026-10-17: "as the feed
// characters grow so does the story arc"; proposals she approves) ──
// services/seasonArcProposals.

const decidedBy = (req) => req.user?.email || req.user?.id || null;

// GET /world/:showId/season/proposals — the open proposal and the last decided
router.get('/world/:showId/season/proposals', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { listProposals } = require('../services/seasonArcProposals');
    return res.json({ success: true, ...(await listProposals(models, req.params.showId)) });
  } catch (err) {
    return sendSlotError(res, err, 'list proposals');
  }
});

// POST /world/:showId/season/proposals — ask now (one AI call)
router.post('/world/:showId/season/proposals', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const models = require('../models');
    const { propose } = require('../services/seasonArcProposals');
    const result = await propose(models, req.params.showId, { trigger: 'manual', force: true });
    return res.json({ success: true, ...result });
  } catch (err) {
    return sendSlotError(res, err, 'propose');
  }
});

// POST /world/:showId/season/proposals/:proposalId/accept — apply the chosen changes
router.post('/world/:showId/season/proposals/:proposalId/accept', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { accept } = require('../services/seasonArcProposals');
    const indexes = Array.isArray(req.body?.changes) ? req.body.changes : null;
    return res.json({ success: true, ...(await accept(models, req.params.showId, req.params.proposalId, { indexes, by: decidedBy(req) })) });
  } catch (err) {
    return sendSlotError(res, err, 'accept proposal');
  }
});

// POST /world/:showId/season/proposals/:proposalId/dismiss
router.post('/world/:showId/season/proposals/:proposalId/dismiss', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { dismiss } = require('../services/seasonArcProposals');
    return res.json({ success: true, ...(await dismiss(models, req.params.showId, req.params.proposalId, { by: decidedBy(req) })) });
  } catch (err) {
    return sendSlotError(res, err, 'dismiss proposal');
  }
});

// ── The reveal plan (stage E; services/seasonRevealPlan) ───────────────────

const sendPlanError = (res, err, label) => {
  const { RevealPlanError } = require('../services/seasonRevealPlan');
  if (err instanceof RevealPlanError) return res.status(err.status).json({ error: err.message });
  console.error(`[ArcRoutes] ${label} error:`, err);
  return res.status(500).json({ error: err.message });
};

// GET /world/:showId/season/reveals — the plan, the slots and the show's secrets
router.get('/world/:showId/season/reveals', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { getPlan } = require('../services/seasonRevealPlan');
    return res.json({ success: true, ...(await getPlan(models.sequelize, req.params.showId)) });
  } catch (err) {
    return sendPlanError(res, err, 'reveal plan');
  }
});

// PUT /world/:showId/season/reveals — add or change one slot's plan for a secret
router.put('/world/:showId/season/reveals', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { setReveal } = require('../services/seasonRevealPlan');
    return res.json({ success: true, ...(await setReveal(models.sequelize, req.params.showId, req.body || {}, { by: decidedBy(req) })) });
  } catch (err) {
    return sendPlanError(res, err, 'set reveal');
  }
});

// DELETE /world/:showId/season/reveals/:revealId
router.delete('/world/:showId/season/reveals/:revealId', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { deleteReveal } = require('../services/seasonRevealPlan');
    return res.json({ success: true, ...(await deleteReveal(models.sequelize, req.params.showId, req.params.revealId)) });
  } catch (err) {
    return sendPlanError(res, err, 'delete reveal');
  }
});

// ── Season twists (2026-10-23; services/seasonTwists) ─────────────────────

const sendTwistError = (res, err, label) => {
  const { TwistError } = require('../services/seasonTwists');
  if (err instanceof TwistError) return res.status(err.status).json({ error: err.message });
  console.error(`[ArcRoutes] ${label} error:`, err);
  return res.status(500).json({ error: err.message });
};

// GET /world/:showId/season/twists — the twists, the slots, threads and characters
router.get('/world/:showId/season/twists', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { getTwists } = require('../services/seasonTwists');
    return res.json({ success: true, ...(await getTwists(models.sequelize, req.params.showId)) });
  } catch (err) {
    return sendTwistError(res, err, 'season twists');
  }
});

// PUT /world/:showId/season/twists — add a twist (or change one, body.id)
router.put('/world/:showId/season/twists', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { setTwist } = require('../services/seasonTwists');
    return res.json({ success: true, ...(await setTwist(models.sequelize, req.params.showId, req.body || {}, { by: decidedBy(req) })) });
  } catch (err) {
    return sendTwistError(res, err, 'set twist');
  }
});

// PUT /world/:showId/season/twists/:twistId — change one
router.put('/world/:showId/season/twists/:twistId', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { setTwist } = require('../services/seasonTwists');
    const body = { ...(req.body || {}), id: req.params.twistId };
    return res.json({ success: true, ...(await setTwist(models.sequelize, req.params.showId, body, { by: decidedBy(req) })) });
  } catch (err) {
    return sendTwistError(res, err, 'change twist');
  }
});

// DELETE /world/:showId/season/twists/:twistId — soft delete
router.delete('/world/:showId/season/twists/:twistId', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { deleteTwist } = require('../services/seasonTwists');
    return res.json({ success: true, ...(await deleteTwist(models.sequelize, req.params.showId, req.params.twistId)) });
  } catch (err) {
    return sendTwistError(res, err, 'delete twist');
  }
});

// POST /world/:showId/season/twists/suggest — drafts from the AI, for Evoni to keep, edit or drop
router.post('/world/:showId/season/twists/suggest', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const models = require('../models');
    const { suggestTwists } = require('../services/seasonTwists');
    return res.json({ success: true, ...(await suggestTwists(models.sequelize, req.params.showId)) });
  } catch (err) {
    return sendTwistError(res, err, 'suggest twists');
  }
});

// GET /episodes/:episodeId/season-twists — what the episode plants and pays off
router.get('/episodes/:episodeId/season-twists', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { twistsForEpisode } = require('../services/seasonTwists');
    return res.json({ success: true, ...(await twistsForEpisode(models.sequelize, req.params.episodeId)) });
  } catch (err) {
    return sendTwistError(res, err, 'episode twists');
  }
});

// POST /episodes/:episodeId/season-twists/:twistId/mark — { as: planted|paid_off }
router.post('/episodes/:episodeId/season-twists/:twistId/mark', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { markTwist } = require('../services/seasonTwists');
    const result = await markTwist(models.sequelize, req.params.episodeId, req.params.twistId, req.body?.as);
    return res.json({ success: true, ...result });
  } catch (err) {
    return sendTwistError(res, err, 'mark twist');
  }
});

// POST /world/:showId/season/twists/:twistId/restore — Undo for a delete
router.post('/world/:showId/season/twists/:twistId/restore', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { restoreTwist } = require('../services/seasonTwists');
    return res.json({ success: true, ...(await restoreTwist(models.sequelize, req.params.showId, req.params.twistId)) });
  } catch (err) {
    return sendTwistError(res, err, 'restore twist');
  }
});

module.exports = router;

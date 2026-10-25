'use strict';

/**
 * Arc Routes
 * Mount at: /api/v1
 *
 * GET    /world/:showId/arc              — Get the active arc (else the latest) with phases, debt, temperature,
 *                                           and next_season_number for "Start Season N"; `seasons` lists every
 *                                           season (id, number, title, status) for the Season page's switcher,
 *                                           and ?season=N reads that season instead (404 when the show has none)
 * POST   /world/:showId/arc/seed         — Seed the next season from the "Set up the season" form
 *                                           ({ title, tagline, phases: [{ title, tagline }] x3, split: [n, n, n] })
 * PUT    /world/:showId/arc/setup        — "Edit season": the same form; re-phases slots not started. Also the
 *                                           Season page's fields it sends (cover_url, starts_on, ends_on, logline,
 *                                           description, phases[i].picture_url); one left out keeps what is saved
 * GET    /world/:showId/season/placement — Preview: existing episodes and unused events into open slots
 * POST   /world/:showId/season/placement — Save the preview ({ items: [{ slot_id, episode_id | event_id }] }), one transaction
 * POST   /world/:showId/season/draft     — Draft the season, or one part ({ phase }), in one AI call; nothing saved
 * POST   /world/:showId/season/draft/accept — Save accepted drafts ({ drafts: [...] }) as Auto-drafted intentions
 * POST   /world/:showId/arc/advance      — Manual phase advance (with warning)
 * POST   /world/:showId/arc/advance/confirm — Force advance after warning acknowledged
 * GET    /world/:showId/season/roadmap — The active season's 24 slots and their states (Season Arc A2); ?season=N another season's
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
 * GET    /world/:showId/season/insights — Planning Insights: plan beside result, money from the ledger (A8, Q13, Q15); ?season=N another season's
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
 * GET    /world/:showId/season/needs — The relationships the season needs (planner PR 3, 2026-10-24): each
 *                                       twist's, thread's and slot purpose's pairs, the slot each is needed by,
 *                                       and whether it is there, a seed only, or missing (services/seasonNeeds)
 * GET    /world/:showId/season/knows — What the season's AI reads of the story so far: the latest approved
 *                                       What changed record and the open follow-ups
 * GET    /world/:showId/season/slots/:slotId/notes — The slot's twists (plant, payoff) and reveals, for its panel
 * GET    /world/:showId/season/slots/:slotId/event-fit — Events that can be pencilled into the slot, best fit first
 * GET    /world/:showId/season/goal-coverage — Each active goal's movers (placed events that move it, by fit or pin),
 *                                             its projection, the parts nothing moves it in, the slots' chips;
 *                                             ?event_id= adds what that event moves (services/seasonGoalCoverage)
 * GET    /world/:showId/season/goals/:goalId/events — "Find events": the events that move the goal first, placed or not
 * PUT    /world/:showId/season/events/:eventId/goals/:goalId/pin — Pin the goal to the event (a pin always counts)
 * DELETE /world/:showId/season/events/:eventId/goals/:goalId/pin — Unpin it
 * GET    /episodes/:episodeId/season-twists — The twists this episode plants and pays off (the Script tab)
 * POST   /episodes/:episodeId/season-twists/:twistId/mark — { as: planted|paid_off, undo? }: Evoni marks it done here, or takes the mark back
 *
 * Removed with no caller (planner PR 4, 2026-10-24): GET /world/:showId/arc/context
 * (getArcContext stays: the feed and the script writer call it directly) and
 * PUT /world/:showId/arc/phase/:phase.
 *
 * Extend (lengthen the current phase, pushing the season past 24) is removed:
 * "Remove Extend; phase boundaries can shift within the 24, only across slots
 * that haven't started." (Evoni, 2026-10-01, §8(ff) Q2)
 */

const express = require('express');
const router = express.Router();

const { requireAuth, authorize } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');

/**
 * ?season=N (the Season page's season switcher, 2026-10-25): that season's
 * arc id, of this show only; null when absent. Sends 400 for a value that is
 * not a season number and 404 when the show has no such season, returning
 * undefined so the route stops.
 */
async function seasonArcId(models, req, res) {
  const raw = req.query.season;
  if (raw == null || raw === '') return null;
  if (!/^[1-9]\d{0,2}$/.test(String(raw))) {
    res.status(400).json({ error: 'season must be a season number' });
    return undefined;
  }
  const [rows] = await models.sequelize.query(
    `SELECT id FROM show_arcs WHERE show_id = :showId AND deleted_at IS NULL AND COALESCE(season_number, 1) = :season
      ORDER BY (status = 'active') DESC, arc_number DESC LIMIT 1`,
    { replacements: { showId: req.params.showId, season: Number(raw) } });
  if (!rows[0]) {
    res.status(404).json({ error: `This show has no Season ${raw}.` });
    return undefined;
  }
  return rows[0].id;
}

// GET /world/:showId/arc — active arc (or ?season=N)
router.get('/world/:showId/arc', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { showId } = req.params;
    const wanted = req.query.season != null && req.query.season !== '' ? String(req.query.season) : null;
    if (wanted && !/^[1-9]\d{0,2}$/.test(wanted)) return res.status(400).json({ error: 'season must be a season number' });

    const [arcs] = await models.sequelize.query(
      `SELECT * FROM show_arcs WHERE show_id = :showId AND deleted_at IS NULL
       ORDER BY arc_number ASC`,
      { replacements: { showId } }
    );

    if (!arcs?.length) {
      return res.json({ success: true, arc: null, next_season_number: 1, message: 'No arc found. Seed one first.' });
    }

    // The season in progress; else the latest, so a completed season shows "Start Season N".
    const current = arcs.find(a => a.status === 'active') || arcs[arcs.length - 1];
    let arc = current;
    if (wanted) {
      const same = arcs.filter((a) => Number(a.season_number || 1) === Number(wanted));
      arc = same.find((a) => a.status === 'active') || same[same.length - 1];
      if (!arc) return res.status(404).json({ error: `This show has no Season ${wanted}.` });
    }
    const phases = typeof arc.phases === 'string' ? JSON.parse(arc.phases) : arc.phases;
    const debt = typeof arc.narrative_debt === 'string' ? JSON.parse(arc.narrative_debt) : arc.narrative_debt;
    const log = typeof arc.progression_log === 'string' ? JSON.parse(arc.progression_log) : arc.progression_log;

    const nextSeason = Math.max(0, ...arcs.map((a) => Number(a.season_number) || 0)) + 1;
    const { savedDay } = require('../services/seasonSetupService');
    return res.json({
      success: true,
      next_season_number: nextSeason,
      // Every season, for the switcher; current_arc_id is the one in progress (else the latest).
      seasons: arcs.map((a) => ({ id: a.id, season_number: Number(a.season_number || 1), title: a.title, status: a.status })),
      current_arc_id: current.id,
      arc: {
        ...arc,
        // The Season page's dates as YYYY-MM-DD, never shifted by a time zone.
        starts_on: savedDay(arc.starts_on),
        ends_on: savedDay(arc.ends_on),
        phases,
        narrative_debt: debt,
        progression_log: log,
        current_phase_detail: phases.find(p => p.phase === arc.current_phase),
      },
    });
  } catch (err) {
    console.error('[ArcRoutes] season arc load error:', err);
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
    // The page's Advance buttons send no body (Express 5 leaves req.body undefined).
    const { episode_number } = req.body || {};

    const result = await advancePhase(req.params.showId, models, {
      triggered_by: 'manual',
      force: false,
      episode_number,
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[ArcRoutes] advance phase error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /world/:showId/arc/advance/confirm — force advance after warning
router.post('/world/:showId/arc/advance/confirm', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { advancePhase } = require('../services/arcProgressionService');
    // The page's Advance buttons send no body (Express 5 leaves req.body undefined).
    const { episode_number } = req.body || {};

    const result = await advancePhase(req.params.showId, models, {
      triggered_by: 'manual',
      force: true,
      episode_number,
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[ArcRoutes] confirm advance error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /world/:showId/season/roadmap — the Season Arc roadmap (§8(ff) A2), read-only
router.get('/world/:showId/season/roadmap', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { getRoadmap } = require('../services/seasonSlotService');
    const arcId = await seasonArcId(models, req, res);
    if (arcId === undefined) return undefined;
    const roadmap = await getRoadmap(models.sequelize, req.params.showId, { arcId });
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
    const arcId = await seasonArcId(models, req, res);
    if (arcId === undefined) return undefined;
    const insights = await getInsights(models.sequelize, req.params.showId, { arcId });
    return res.json({ success: true, insights });
  } catch (err) {
    console.error('[ArcRoutes] season insights error:', err);
    return res.status(500).json({ error: err.message });
  }
});

function sendSlotError(res, err, label) {
  // A refusal (409, 400 …) is expected; it is logged as a warning, never dropped.
  if (err.status && err.code) {
    console.warn(`[ArcRoutes] ${label} refused (${err.code}):`, err.message);
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
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

// ─── What the season needs and knows (planner PR 3; Evoni, 2026-10-24) ─────

const SHOW_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const badShow = (req, res) => {
  if (SHOW_UUID.test(String(req.params.showId || ''))) return false;
  res.status(400).json({ error: 'showId must be a UUID' });
  return true;
};

// GET /world/:showId/season/needs — the relationships the season needs, read-only
router.get('/world/:showId/season/needs', requireAuth, async (req, res) => {
  if (badShow(req, res)) return undefined;
  try {
    const models = require('../models');
    const { getNeeds } = require('../services/seasonNeeds');
    return res.json({ success: true, ...(await getNeeds(models.sequelize, req.params.showId)) });
  } catch (err) {
    return sendSlotError(res, err, 'season needs');
  }
});

// GET /world/:showId/season/knows — the latest approved What changed record and the open follow-ups
router.get('/world/:showId/season/knows', requireAuth, async (req, res) => {
  if (badShow(req, res)) return undefined;
  try {
    const models = require('../models');
    const { seasonKnows } = require('../services/seasonNeeds');
    return res.json({ success: true, ...(await seasonKnows(models.sequelize, req.params.showId)) });
  } catch (err) {
    return sendSlotError(res, err, 'season knows');
  }
});

// GET /world/:showId/season/slots/:slotId/notes — the slot's twists and reveals, read-only
router.get('/world/:showId/season/slots/:slotId/notes', requireAuth, async (req, res) => {
  if (badShow(req, res)) return undefined;
  try {
    const models = require('../models');
    const { slotNotes } = require('../services/seasonNeeds');
    const notes = await slotNotes(models.sequelize, req.params.showId, req.params.slotId);
    if (!notes) return res.status(404).json({ error: 'That slot is not in this show\'s season.' });
    return res.json({ success: true, ...notes });
  } catch (err) {
    return sendSlotError(res, err, 'slot notes');
  }
});

// GET /world/:showId/season/slots/:slotId/event-fit — "Pencil an event", best fit first, each with a reason
router.get('/world/:showId/season/slots/:slotId/event-fit', requireAuth, async (req, res) => {
  if (badShow(req, res)) return undefined;
  try {
    const models = require('../models');
    const { rankEventsForSlot } = require('../services/seasonSetupService');
    return res.json({ success: true, ...(await rankEventsForSlot(models.sequelize, req.params.showId, req.params.slotId)) });
  } catch (err) {
    return sendSlotError(res, err, 'event fit');
  }
});

// ─── Goals and the events that move them (Evoni, 2026-10-25) ──────────────

const badIds = (req, res, names) => {
  const bad = names.find((n) => !SHOW_UUID.test(String(req.params[n] || '')));
  if (!bad) return false;
  res.status(400).json({ error: `${bad} must be a UUID` });
  return true;
};

// GET /world/:showId/season/goal-coverage — movers, projection, part gaps and slot chips, read-only
router.get('/world/:showId/season/goal-coverage', requireAuth, async (req, res) => {
  if (badShow(req, res)) return undefined;
  const eventId = req.query.event_id ? String(req.query.event_id) : null;
  if (eventId && !SHOW_UUID.test(eventId)) return res.status(400).json({ error: 'event_id must be a UUID' });
  try {
    const models = require('../models');
    const { goalCoverage } = require('../services/seasonGoalCoverage');
    return res.json({ success: true, ...(await goalCoverage(models.sequelize, req.params.showId, { eventId })) });
  } catch (err) {
    return sendSlotError(res, err, 'goal coverage');
  }
});

// GET /world/:showId/season/goals/:goalId/events — "Find events" for one goal, read-only
router.get('/world/:showId/season/goals/:goalId/events', requireAuth, async (req, res) => {
  if (badIds(req, res, ['showId', 'goalId'])) return undefined;
  try {
    const models = require('../models');
    const { goalEvents } = require('../services/seasonGoalCoverage');
    return res.json({ success: true, ...(await goalEvents(models.sequelize, req.params.showId, req.params.goalId)) });
  } catch (err) {
    return sendSlotError(res, err, 'goal events');
  }
});

// PUT and DELETE /world/:showId/season/events/:eventId/goals/:goalId/pin — pin or unpin; other keys kept
const pinRoute = (on) => async (req, res) => {
  if (badIds(req, res, ['showId', 'eventId', 'goalId'])) return undefined;
  try {
    const models = require('../models');
    const { setPin } = require('../services/seasonGoalCoverage');
    return res.json({ success: true, ...(await setPin(models.sequelize, req.params.showId, req.params.eventId, req.params.goalId, on)) });
  } catch (err) {
    return sendSlotError(res, err, on ? 'pin goal' : 'unpin goal');
  }
};
router.put('/world/:showId/season/events/:eventId/goals/:goalId/pin', requireAuth, pinRoute(true));
router.delete('/world/:showId/season/events/:eventId/goals/:goalId/pin', requireAuth, pinRoute(false));

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
  if (err instanceof RevealPlanError) {
    console.warn(`[ArcRoutes] ${label} refused:`, err.message);
    return res.status(err.status).json({ error: err.message });
  }
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
  if (err instanceof TwistError) {
    console.warn(`[ArcRoutes] ${label} refused:`, err.message);
    return res.status(err.status).json({ error: err.message });
  }
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
    // { undo: true } takes the mark back (Script tab audit 6, 2026-10-24).
    const result = await markTwist(models.sequelize, req.params.episodeId, req.params.twistId, req.body?.as, { undo: req.body?.undo === true });
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

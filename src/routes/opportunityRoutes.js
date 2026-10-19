'use strict';

/**
 * Opportunity Routes — Career pipeline CRUD
 *
 * GET    /api/v1/opportunities/:showId            — List opportunities
 * POST   /api/v1/opportunities/:showId            — Create opportunity
 * PUT    /api/v1/opportunities/:showId/:id        — Update opportunity
 * DELETE /api/v1/opportunities/:showId/:id        — Delete opportunity
 * POST   /api/v1/opportunities/:showId/:id/advance — Advance pipeline status
 * POST   /api/v1/opportunities/:showId/:id/to-event — Convert to world event
 * GET    /api/v1/opportunities/:showId/stats       — Pipeline stats
 *
 * Every write here is ADMIN only; the reads stay requireAuth (Evoni,
 * 2026-10-19: "this whole part of the site is admin only").
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const { requireAuth, authorize } = require('../middleware/auth');

async function getModels(req) {
  return req?.app?.get('models') || req?.app?.locals?.db || require('../models');
}

// ─── STATUS PIPELINE ────────────────────────────────────────────────────────
const STATUS_FLOW = {
  offered: ['considering', 'declined'],
  considering: ['negotiating', 'declined'],
  negotiating: ['booked', 'declined'],
  booked: ['preparing', 'cancelled'],
  preparing: ['active', 'cancelled'],
  active: ['completed'],
  completed: ['paid', 'archived'],
  paid: ['archived'],
  declined: ['archived'],
  expired: ['archived'],
  cancelled: ['archived'],
};

// ─── TYPE CONFIGS (wardrobe + content requirements) ─────────────────────────
const TYPE_DEFAULTS = {
  modeling: { wardrobe: { style_direction: 'As directed by creative team', provided_pieces: true }, deliverables: ['Show up on time', 'Follow creative direction', 'Sign usage rights'] },
  runway: { wardrobe: { style_direction: 'Designer provides all pieces', provided_pieces: true, dress_code: 'runway' }, deliverables: ['Attend fitting', 'Walk rehearsal', 'Walk show'] },
  editorial: { wardrobe: { style_direction: 'Styled by magazine team', provided_pieces: true }, deliverables: ['Photo shoot', 'Interview if requested', 'Pulse mention'] },
  campaign: { wardrobe: { style_direction: 'Brand aesthetic — provided or styled', provided_pieces: true }, deliverables: ['Campaign shoot', 'Pulse posts per contract', 'Exclusivity period'] },
  ambassador: { wardrobe: { style_direction: 'Wear brand regularly, authentically', provided_pieces: true }, deliverables: ['Monthly Pulse posts', 'Event appearances', 'Exclusivity compliance'] },
  brand_deal: { wardrobe: { style_direction: 'Incorporate product naturally' }, deliverables: ['Sponsored Pulse content', 'Pulse story mentions', 'Engagement targets'] },
  podcast: { wardrobe: { style_direction: 'Camera-ready casual' }, deliverables: ['Appear on show', 'Promote episode'] },
  interview: { wardrobe: { style_direction: 'Publication-appropriate' }, deliverables: ['Interview session', 'Photo if needed'] },
  award_show: { wardrobe: { style_direction: 'Red carpet — statement piece', dress_code: 'black_tie' }, deliverables: ['Red carpet appearance', 'Pulse coverage'] },
};

// What only the pipeline and beat 14 set (Script page re-audit, 2026-10-19):
// the status moves by Advance and Undo, held and offered_in_episode_id by
// beat 14's attach, detach and completion. A create or update that sent them
// could hold an opportunity, or free one beat 14 had already offered.
const PIPELINE_ONLY = ['status', 'status_history', 'offered_in_episode_id'];
const withoutPipelineFields = (body) => {
  const out = { ...(body && typeof body === 'object' ? body : {}) };
  for (const k of PIPELINE_ONLY) delete out[k];
  return out;
};

/** The body with its company linked (services/brandProfile.linkDeal), or null with a 400 sent. */
async function linkDealOr400(res, models, body) {
  const { linkDeal, CompanyError } = require('../services/brandProfile');
  try {
    return await linkDeal(models, body);
  } catch (err) {
    if (err instanceof CompanyError) { res.status(err.status).json({ success: false, error: err.message }); return null; }
    throw err;
  }
}

// ═══════════════════════════════════════════
// GET /opportunities/:showId — List
// ═══════════════════════════════════════════

// Each opportunity attached to an episode's beat 14 carries that episode
// ({ id, title }) as beat14_episode, so the show tab can say "Beat 14 of
// ‹title›" (Evoni, 2026-10-19). One query for all of them; a failed read
// leaves the titles out.
async function withBeat14Episodes(models, opps) {
  const ids = [...new Set(opps.map((o) => o.offered_in_episode_id).filter(Boolean))];
  if (!ids.length || !models.sequelize) return opps;
  try {
    const rows = await models.sequelize.query(
      'SELECT id, title FROM episodes WHERE id IN (:ids) AND deleted_at IS NULL',
      { replacements: { ids }, type: models.sequelize.QueryTypes.SELECT }
    );
    const byId = new Map(rows.map((r) => [String(r.id), r]));
    return opps.map((o) => {
      const ep = o.offered_in_episode_id ? byId.get(String(o.offered_in_episode_id)) : null;
      return ep ? { ...o, beat14_episode: { id: ep.id, title: ep.title || null } } : o;
    });
  } catch (err) {
    console.error('[Opportunities] beat 14 episode titles read failed (non-blocking):', err.message);
    return opps;
  }
}

router.get('/opportunities/:showId', requireAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { status, type } = req.query;
    const models = await getModels(req);

    if (models.Opportunity) {
      const where = { show_id: showId };
      if (status) where.status = status;
      if (type) where.opportunity_type = type;
      const opps = (await models.Opportunity.findAll({ where, order: [['created_at', 'DESC']] })).map(o => o.toJSON());
      return res.json({ success: true, opportunities: await withBeat14Episodes(models, opps) });
    }

    // Fallback raw SQL
    const [opps] = await models.sequelize.query(
      'SELECT * FROM opportunities WHERE show_id = :showId AND deleted_at IS NULL ORDER BY created_at DESC',
      { replacements: { showId } }
    );
    return res.json({ success: true, opportunities: opps });
  } catch (err) {
    console.error('[Opportunities] list failed:', err.message);
    if (err.message?.includes('does not exist')) return res.json({ success: true, opportunities: [] });
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════
// POST /opportunities/:showId — Create
// ═══════════════════════════════════════════

router.post('/opportunities/:showId', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const { showId } = req.params;
    const models = await getModels(req);
    const body = withoutPipelineFields(req.body);

    // Apply type defaults
    const typeDefaults = TYPE_DEFAULTS[body.opportunity_type] || {};
    if (!body.wardrobe_brief && typeDefaults.wardrobe) body.wardrobe_brief = typeDefaults.wardrobe;
    if ((!body.deliverables || body.deliverables.length === 0) && typeDefaults.deliverables) {
      body.deliverables = typeDefaults.deliverables.map(d => ({ description: d, completed: false }));
    }

    // Auto-calculate net value
    body.net_value = (parseFloat(body.payment_amount) || 0) - (parseFloat(body.expenses) || 0);

    // Set offer date if not provided
    if (!body.offer_date) body.offer_date = new Date().toISOString().split('T')[0];

    // The company the deal is with (services/brandProfile.linkDeal; Evoni,
    // 2026-10-18): a picked company, or the one whose name was typed.
    const linked = await linkDealOr400(res, models, body);
    if (!linked) return undefined;

    const data = { id: uuidv4(), show_id: showId, ...linked, status: 'offered', status_history: [{ status: 'offered', date: new Date().toISOString() }] };

    let opp;
    if (models.Opportunity) {
      opp = await models.Opportunity.create(data);
    } else {
      await models.sequelize.query(
        `INSERT INTO opportunities (id, show_id, name, opportunity_type, category, status, status_history,
         brand_or_company, prestige, payment_amount, payment_type, narrative_stakes, wardrobe_brief,
         deliverables, created_at, updated_at)
         VALUES (:id, :show_id, :name, :opportunity_type, :category, 'offered', :status_history,
         :brand_or_company, :prestige, :payment_amount, :payment_type, :narrative_stakes, :wardrobe_brief,
         :deliverables, NOW(), NOW())`,
        { replacements: { ...data, status_history: JSON.stringify(data.status_history), wardrobe_brief: JSON.stringify(data.wardrobe_brief || {}), deliverables: JSON.stringify(data.deliverables || []) } }
      );
      opp = data;
    }

    return res.status(201).json({ success: true, opportunity: opp.toJSON ? opp.toJSON() : opp });
  } catch (err) {
    console.error('[Opportunities] create failed:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════
// PUT /opportunities/:showId/:id — Update
// ═══════════════════════════════════════════

router.put('/opportunities/:showId/:id', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const { showId, id } = req.params;
    const models = await getModels(req);
    const body = withoutPipelineFields(req.body);

    // Recalculate net value if payment changed
    if (body.payment_amount !== undefined || body.expenses !== undefined) {
      const payment = parseFloat(body.payment_amount) || 0;
      const expenses = parseFloat(body.expenses) || 0;
      body.net_value = payment - expenses;
    }

    if (models.Opportunity) {
      const opp = await models.Opportunity.findOne({ where: { id, show_id: showId } });
      if (!opp) return res.status(404).json({ success: false, error: 'Opportunity not found' });
      const linked = await linkDealOr400(res, models, body);
      if (!linked) return undefined;
      await opp.update(linked);
      return res.json({ success: true, opportunity: opp.toJSON() });
    }

    return res.status(500).json({ success: false, error: 'Opportunity model not loaded' });
  } catch (err) {
    console.error('[Opportunities] update failed:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════
// POST /opportunities/:showId/:id/advance — Advance pipeline
// ═══════════════════════════════════════════

router.post('/opportunities/:showId/:id/advance', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const { showId, id } = req.params;
    const { to_status, note } = req.body;
    const models = await getModels(req);

    if (!models.Opportunity) return res.status(500).json({ success: false, error: 'Model not loaded' });

    const opp = await models.Opportunity.findOne({ where: { id, show_id: showId } });
    if (!opp) return res.status(404).json({ success: false, error: 'Opportunity not found' });

    const allowed = STATUS_FLOW[opp.status] || [];
    if (!allowed.includes(to_status)) {
      return res.status(400).json({ success: false, error: `Cannot advance from "${opp.status}" to "${to_status}". Allowed: ${allowed.join(', ')}` });
    }

    // A new array: a JSONB array changed in place is never saved by
    // Sequelize, so no step was ever written to the history (Script page
    // audit, 2026-10-19: Undo found nothing to go back to).
    const history = [...(Array.isArray(opp.status_history) ? opp.status_history : []), { status: to_status, date: new Date().toISOString(), note: note || null, from: opp.status }];

    const updates = { status: to_status, status_history: history };
    if (to_status === 'booked') updates.booking_date = new Date().toISOString().split('T')[0];
    if (to_status === 'paid') updates.payment_status = 'paid';

    await opp.update(updates);

    // Career pipeline: cascade to career goals on completion/payment
    let pipelineResult = null;
    if (['completed', 'paid'].includes(to_status)) {
      try {
        const { onOpportunityAdvanced } = require('../services/careerPipelineService');
        pipelineResult = await onOpportunityAdvanced(id, to_status, models);
        if (pipelineResult.goals_completed.length > 0) {
          console.log(`[CareerPipeline] Goals completed: ${pipelineResult.goals_completed.map(g => g.title).join(', ')}`);
        }
        if (pipelineResult.unlocks.length > 0) {
          console.log(`[CareerPipeline] Unlocked ${pipelineResult.unlocks.length} new opportunities`);
        }
      } catch (err) { console.warn('[CareerPipeline] Cascade failed:', err.message); }
    }

    return res.json({
      success: true,
      opportunity: opp.toJSON(),
      advanced: { from: history[history.length - 1].from, to: to_status },
      pipeline: pipelineResult,
    });
  } catch (err) {
    console.error('[Opportunities] advance failed:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════
// POST /opportunities/:showId/:id/undo — Undo the last step (Evoni,
// 2026-10-19: an Advance click marked one complete when she meant to set it
// up). Back to the status it had before its last step, with an 'Undone'
// entry in its history. Only the status moves: what the career pipeline did
// on completed or paid (goals checked, opportunities unlocked) is NOT
// reversed, nor the booking date or payment status set on the way. One held
// for beat 14 belongs to that episode: detach it there instead.
// ═══════════════════════════════════════════

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The status before the last step, reading the history as a stack: each
 * entry is a step, an 'Undone' entry takes one back. Null when the history
 * does not end on the current status or holds nothing earlier.
 */
function statusBeforeLastStep(history, current) {
  const stack = [];
  for (const h of Array.isArray(history) ? history : []) {
    if (!h || typeof h.status !== 'string') continue;
    if (h.note === 'Undone' && h.undone_from) { stack.pop(); if (stack[stack.length - 1] !== h.status) stack.push(h.status); continue; }
    stack.push(h.status);
  }
  // Steps made before the history was saved: the last status written is
  // the one before.
  if (stack.length && stack[stack.length - 1] !== current) return stack[stack.length - 1];
  for (let i = stack.length - 2; i >= 0; i -= 1) if (stack[i] !== current) return stack[i];
  return null;
}

router.post('/opportunities/:showId/:id/undo', requireAuth, authorize(['ADMIN']), async (req, res) => {
  const { showId, id } = req.params;
  if (!UUID_RE.test(String(showId)) || !UUID_RE.test(String(id))) {
    return res.status(400).json({ success: false, error: `${UUID_RE.test(String(showId)) ? 'id' : 'showId'} must be an id (UUID).` });
  }
  try {
    const models = await getModels(req);
    if (!models.Opportunity) return res.status(500).json({ success: false, error: 'Model not loaded' });
    const opp = await models.Opportunity.findOne({ where: { id, show_id: showId } });
    if (!opp) return res.status(404).json({ success: false, error: 'Opportunity not found' });
    if (opp.status === 'held') {
      return res.status(409).json({ success: false, error: 'This one is held for an episode\'s beat 14: remove it from beat 14 on that episode\'s Script tab instead.' });
    }
    const history = Array.isArray(opp.status_history) ? opp.status_history : [];
    const back = statusBeforeLastStep(history, opp.status);
    if (!back) return res.status(409).json({ success: false, error: `There is no earlier status to go back to from "${opp.status}".` });
    // Held is beat 14's to set, at attach (services/beat14Opportunity).
    if (back === 'held') return res.status(409).json({ success: false, error: 'Its last step came from beat 14 (attached, let go or decided at completion); that is not undone here.' });
    const from = opp.status;
    await opp.update({
      status: back,
      status_history: [...history, { status: back, date: new Date().toISOString(), note: 'Undone', undone_from: from }],
    });
    return res.json({ success: true, opportunity: opp.toJSON(), undone: { from, to: back } });
  } catch (err) {
    console.error('[Opportunities] undo failed:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════
// POST /opportunities/:showId/:id/to-event — Convert to world event
// ═══════════════════════════════════════════

router.post('/opportunities/:showId/:id/to-event', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const { showId, id } = req.params;
    const models = await getModels(req);

    if (!models.Opportunity) return res.status(500).json({ success: false, error: 'Model not loaded' });

    const { convertOpportunityToEvent } = require('../services/careerPipelineService');
    const result = await convertOpportunityToEvent(id, showId, models);

    return res.json({ success: true, event: result.event, opportunity: result.opportunity });
  } catch (err) {
    console.error('[Opportunities] to-event failed:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════
// Beat 14's opportunity (Evoni, 2026-10-19; services/beat14Opportunity):
// the invitation someone at the event offers at the end of the episode.
//   GET    — what is attached, who at the event can offer, open ones to attach
//   PUT    — { opportunity_id, connector_profile_id } or { create: { … } }
//   DELETE — nothing attached
// ═══════════════════════════════════════════

const beat14Error = (res, err, what) => {
  console.error(`[Beat14] ${what} failed:`, err.message);
  // Two attaches at once both pass the service's checks; the unique index on
  // offered_in_episode_id lets one through (Script page audit, 2026-10-19).
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ success: false, error: 'Beat 14 changed while this was saved: read it again and choose once more.' });
  }
  return res.status(err.status || 500).json({ success: false, error: err.message });
};

// Ids that are not UUIDs are a 400, not a database error and a 500 (Script
// page audit, 2026-10-19).
const BEAT14_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const beat14BadIds = (req, res) => {
  const { showId, episodeId } = req.params;
  const oppId = req.body?.opportunity_id;
  const bad = !BEAT14_UUID.test(String(showId)) ? 'showId'
    : !BEAT14_UUID.test(String(episodeId)) ? 'episodeId'
      : req.method === 'PUT' && oppId != null && oppId !== '' && !BEAT14_UUID.test(String(oppId)) ? 'opportunity_id'
        : null;
  if (!bad) return false;
  res.status(400).json({ success: false, error: `${bad} must be an id (UUID).` });
  return true;
};

router.get('/opportunities/:showId/episode/:episodeId/beat14', requireAuth, async (req, res) => {
  if (beat14BadIds(req, res)) return undefined;
  try {
    const { getBeat14 } = require('../services/beat14Opportunity');
    return res.json({ success: true, data: await getBeat14(await getModels(req), req.params) });
  } catch (err) {
    return beat14Error(res, err, 'read');
  }
});

// Attach and detach are ADMIN only (Evoni, 2026-10-19: "make Beat 14 this
// whole part of the site is admin only"); the read stays requireAuth.
router.put('/opportunities/:showId/episode/:episodeId/beat14', requireAuth, authorize(['ADMIN']), async (req, res) => {
  if (beat14BadIds(req, res)) return undefined;
  try {
    const { attachBeat14 } = require('../services/beat14Opportunity');
    const body = req.body || {};
    const opportunity = await attachBeat14(await getModels(req), {
      ...req.params,
      opportunity_id: body.opportunity_id || null,
      connector_profile_id: body.connector_profile_id ?? null,
      create: body.create && typeof body.create === 'object' ? body.create : null,
    });
    return res.json({ success: true, data: { opportunity } });
  } catch (err) {
    return beat14Error(res, err, 'attach');
  }
});

router.delete('/opportunities/:showId/episode/:episodeId/beat14', requireAuth, authorize(['ADMIN']), async (req, res) => {
  if (beat14BadIds(req, res)) return undefined;
  try {
    const { detachBeat14 } = require('../services/beat14Opportunity');
    return res.json({ success: true, data: await detachBeat14(await getModels(req), req.params) });
  } catch (err) {
    return beat14Error(res, err, 'detach');
  }
});

// ═══════════════════════════════════════════
// DELETE /opportunities/:showId/:id
// ═══════════════════════════════════════════

router.delete('/opportunities/:showId/:id', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const { showId, id } = req.params;
    const models = await getModels(req);
    if (models.Opportunity) {
      await models.Opportunity.destroy({ where: { id, show_id: showId } });
    } else {
      await models.sequelize.query(
        'UPDATE opportunities SET deleted_at = NOW() WHERE id = :id AND show_id = :showId',
        { replacements: { id, showId } }
      );
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('[Opportunities] delete failed:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════
// GET /opportunities/:showId/stats — Pipeline stats
// ═══════════════════════════════════════════

router.get('/opportunities/:showId/stats', requireAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const models = await getModels(req);

    const [rows] = await models.sequelize.query(
      `SELECT status, COUNT(*) as count, SUM(COALESCE(payment_amount, 0)) as total_value
       FROM opportunities WHERE show_id = :showId AND deleted_at IS NULL
       GROUP BY status`,
      { replacements: { showId } }
    );

    const stats = {
      pipeline: rows.reduce((acc, r) => { acc[r.status] = { count: parseInt(r.count), value: parseFloat(r.total_value) || 0 }; return acc; }, {}),
      total_opportunities: rows.reduce((s, r) => s + parseInt(r.count), 0),
      total_value: rows.reduce((s, r) => s + (parseFloat(r.total_value) || 0), 0),
      booked_value: rows.filter(r => ['booked', 'preparing', 'active', 'completed', 'paid'].includes(r.status)).reduce((s, r) => s + (parseFloat(r.total_value) || 0), 0),
    };

    return res.json({ success: true, stats });
  } catch (err) {
    console.error('[Opportunities] stats failed:', err.message);
    if (err.message?.includes('does not exist')) return res.json({ success: true, stats: { pipeline: {}, total_opportunities: 0, total_value: 0, booked_value: 0 } });
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════
// POST /opportunities/:showId/episode-complete/:episodeId — Trigger career pipeline on episode completion
// ═══════════════════════════════════════════

router.post('/opportunities/:showId/episode-complete/:episodeId', requireAuth, authorize(['ADMIN']), async (req, res) => {
  try {
    const { showId, episodeId } = req.params;
    const models = await getModels(req);

    const { onEpisodeCompleted } = require('../services/careerPipelineService');
    const result = await onEpisodeCompleted(episodeId, showId, models);

    return res.json({
      success: true,
      message: `Pipeline cascade complete.`,
      data: result,
    });
  } catch (err) {
    console.error('[CareerPipeline] Episode complete error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════
// GET /opportunities/:showId/career-tier — Get accessible career tier
// ═══════════════════════════════════════════

router.get('/opportunities/:showId/career-tier', requireAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const models = await getModels(req);

    const { getAccessibleCareerTier } = require('../services/careerPipelineService');
    const tier = await getAccessibleCareerTier(showId, models);

    return res.json({ success: true, career_tier: tier });
  } catch (err) {
    console.error('[Opportunities] career tier failed:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
module.exports.statusBeforeLastStep = statusBeforeLastStep;

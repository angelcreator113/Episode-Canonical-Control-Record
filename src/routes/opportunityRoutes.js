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
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

let optionalAuth;
try {
  const authModule = require('../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
} catch {
  optionalAuth = (req, res, next) => next();
}

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
  editorial: { wardrobe: { style_direction: 'Styled by magazine team', provided_pieces: true }, deliverables: ['Photo shoot', 'Interview if requested', 'Social media mention'] },
  campaign: { wardrobe: { style_direction: 'Brand aesthetic — provided or styled', provided_pieces: true }, deliverables: ['Campaign shoot', 'Social posts per contract', 'Exclusivity period'] },
  ambassador: { wardrobe: { style_direction: 'Wear brand regularly, authentically', provided_pieces: true }, deliverables: ['Monthly posts', 'Event appearances', 'Exclusivity compliance'] },
  brand_deal: { wardrobe: { style_direction: 'Incorporate product naturally' }, deliverables: ['Sponsored content', 'Story mentions', 'Engagement targets'] },
  podcast: { wardrobe: { style_direction: 'Camera-ready casual' }, deliverables: ['Appear on show', 'Promote episode'] },
  interview: { wardrobe: { style_direction: 'Publication-appropriate' }, deliverables: ['Interview session', 'Photo if needed'] },
  award_show: { wardrobe: { style_direction: 'Red carpet — statement piece', dress_code: 'black_tie' }, deliverables: ['Red carpet appearance', 'Social documentation'] },
};

// ═══════════════════════════════════════════
// GET /opportunities/:showId — List
// ═══════════════════════════════════════════

router.get('/opportunities/:showId', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { status, type } = req.query;
    const models = await getModels(req);

    if (models.Opportunity) {
      const where = { show_id: showId };
      if (status) where.status = status;
      if (type) where.opportunity_type = type;
      const opps = await models.Opportunity.findAll({ where, order: [['created_at', 'DESC']] });
      return res.json({ success: true, opportunities: opps.map(o => o.toJSON()) });
    }

    // Fallback raw SQL
    const [opps] = await models.sequelize.query(
      'SELECT * FROM opportunities WHERE show_id = :showId AND deleted_at IS NULL ORDER BY created_at DESC',
      { replacements: { showId } }
    );
    return res.json({ success: true, opportunities: opps });
  } catch (err) {
    if (err.message?.includes('does not exist')) return res.json({ success: true, opportunities: [] });
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════
// POST /opportunities/:showId — Create
// ═══════════════════════════════════════════

router.post('/opportunities/:showId', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const models = await getModels(req);
    const body = req.body;

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

    const data = { id: uuidv4(), show_id: showId, ...body, status_history: [{ status: 'offered', date: new Date().toISOString() }] };

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
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════
// PUT /opportunities/:showId/:id — Update
// ═══════════════════════════════════════════

router.put('/opportunities/:showId/:id', optionalAuth, async (req, res) => {
  try {
    const { showId, id } = req.params;
    const models = await getModels(req);
    const body = req.body;

    // Recalculate net value if payment changed
    if (body.payment_amount !== undefined || body.expenses !== undefined) {
      const payment = parseFloat(body.payment_amount) || 0;
      const expenses = parseFloat(body.expenses) || 0;
      body.net_value = payment - expenses;
    }

    if (models.Opportunity) {
      const opp = await models.Opportunity.findOne({ where: { id, show_id: showId } });
      if (!opp) return res.status(404).json({ success: false, error: 'Opportunity not found' });
      await opp.update(body);
      return res.json({ success: true, opportunity: opp.toJSON() });
    }

    return res.status(500).json({ success: false, error: 'Opportunity model not loaded' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════
// POST /opportunities/:showId/:id/advance — Advance pipeline
// ═══════════════════════════════════════════

router.post('/opportunities/:showId/:id/advance', optionalAuth, async (req, res) => {
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

    const history = opp.status_history || [];
    history.push({ status: to_status, date: new Date().toISOString(), note: note || null, from: opp.status });

    const updates = { status: to_status, status_history: history };
    if (to_status === 'booked') updates.booking_date = new Date().toISOString().split('T')[0];
    if (to_status === 'paid') updates.payment_status = 'paid';

    await opp.update(updates);

    // Auto-adjust Lala's state if this is a major milestone
    if (['booked', 'completed'].includes(to_status) && opp.prestige >= 7) {
      try {
        const { SocialProfile } = models;
        // Find Lala's profile (is_justawoman_record or main character)
        const lala = await SocialProfile.findOne({ where: { is_justawoman_record: true } });
        if (lala && lala.current_state !== 'peaking') {
          await lala.update({ previous_state: lala.current_state, current_state: 'peaking', state_changed_at: new Date() });
        }
      } catch { /* non-blocking */ }
    }

    return res.json({ success: true, opportunity: opp.toJSON(), advanced: { from: history[history.length - 1].from, to: to_status } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════
// POST /opportunities/:showId/:id/to-event — Convert to world event
// ═══════════════════════════════════════════

router.post('/opportunities/:showId/:id/to-event', optionalAuth, async (req, res) => {
  try {
    const { showId, id } = req.params;
    const models = await getModels(req);

    if (!models.Opportunity) return res.status(500).json({ success: false, error: 'Model not loaded' });

    const opp = await models.Opportunity.findByPk(id);
    if (!opp) return res.status(404).json({ success: false, error: 'Opportunity not found' });

    // Create world event from opportunity
    const eventData = {
      id: uuidv4(),
      show_id: showId,
      name: opp.name,
      event_type: opp.opportunity_type === 'brand_deal' ? 'brand_deal' : 'invite',
      host: opp.brand_or_company || opp.contact_name || opp.name,
      host_brand: opp.brand_or_company || null,
      prestige: opp.prestige || 5,
      description: opp.narrative_stakes || `${opp.opportunity_type} opportunity: ${opp.name}`,
      narrative_stakes: opp.what_could_go_wrong || opp.narrative_stakes || null,
      location_hint: opp.venue_name || null,
      dress_code: opp.wardrobe_brief?.dress_code || null,
      canon_consequences: {
        automation: {
          source: 'opportunity',
          opportunity_id: opp.id,
          opportunity_type: opp.opportunity_type,
          brand: opp.brand_or_company,
          connector_handle: opp.connector_handle,
          wardrobe_brief: opp.wardrobe_brief,
          payment_amount: opp.payment_amount,
          career_milestone: opp.career_milestone,
        },
      },
      status: 'ready', // Opportunities are pre-vetted, skip draft
    };

    let event;
    if (models.WorldEvent) {
      event = await models.WorldEvent.create(eventData);
    } else {
      await models.sequelize.query(
        `INSERT INTO world_events (id, show_id, name, event_type, host, host_brand, prestige, description,
         narrative_stakes, location_hint, canon_consequences, status, created_at, updated_at)
         VALUES (:id, :show_id, :name, :event_type, :host, :host_brand, :prestige, :description,
         :narrative_stakes, :location_hint, :canon_consequences, 'ready', NOW(), NOW())`,
        { replacements: { ...eventData, canon_consequences: JSON.stringify(eventData.canon_consequences) } }
      );
      event = eventData;
    }

    // Link back
    await opp.update({ event_id: event.id || eventData.id });

    return res.json({ success: true, event: event.toJSON ? event.toJSON() : event, opportunity: opp.toJSON() });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════
// DELETE /opportunities/:showId/:id
// ═══════════════════════════════════════════

router.delete('/opportunities/:showId/:id', optionalAuth, async (req, res) => {
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
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════
// GET /opportunities/:showId/stats — Pipeline stats
// ═══════════════════════════════════════════

router.get('/opportunities/:showId/stats', optionalAuth, async (req, res) => {
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
    if (err.message?.includes('does not exist')) return res.json({ success: true, stats: { pipeline: {}, total_opportunities: 0, total_value: 0, booked_value: 0 } });
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

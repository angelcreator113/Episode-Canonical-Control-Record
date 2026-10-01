/**
 * Deal pricing routes (deal build PR 3; docs/DEAL_DESIGN.md §3.2, §11.1;
 * Task #2341).
 *
 * GET  /api/v1/deal-rates                                    — the newest rate card (read-only)
 * POST /api/v1/world/:showId/events/:eventId/propose-terms   — draft the deal's numbers
 *
 * Propose terms (Evoni's QUESTION 4 answer, §8(cc): "Rates are baselines,
 * not fixed payouts"; her Deal PR 3 ruling, the same section) drafts the
 * whole Terms section in one step since D13 (2026-09-30;
 * dealTermsDraftService.draftTerms): the deliverables by the ticked
 * components (D12's sizing, D15's formats), every component and
 * deliverable fee re-priced from the card, the entry line (and travel and
 * accommodation when Lala travels), the suggested bonus and the
 * relationship goals. What Evoni edited or deleted stays as she left it,
 * except prices, which Propose terms always re-prices. A line with no
 * automatic price (Other, or an anchor not offered at the tier) keeps its
 * number and reads "Price required" until Evoni sets one (ruling 6).
 * Every drafted value is recorded under canon_consequences.automation
 * (doctrine rule 14). After the lock this route refuses with 409, like
 * every terms write.
 *
 * Body: { premiums: { appearance?, partnership_base?, performance?: [{kind,key}],
 *                     deliverables?: { <id>: [{kind,key}] } } }
 *
 * Location: src/routes/dealPricing.js
 */

'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { listEventDeliverables } = require('../services/eventTermsService');
const { findTermsWriteLock, termsLockedBody } = require('../utils/eventTermsLock');
const { loadRateCard, EVENT_COMPONENTS } = require('../services/dealPricingService');
const { listEventCosts } = require('../services/eventCostsService');
const { draftTerms } = require('../services/dealTermsDraftService');

async function getModels() {
  try { return require('../models'); } catch (err) {
    console.error('[DealPricing] models failed to load:', err.message);
    return null;
  }
}

// ═══════════════════════════════════════════
// GET /api/v1/deal-rates — the newest rate card, read-only
// ═══════════════════════════════════════════

router.get('/deal-rates', requireAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const card = await loadRateCard(models.sequelize);
    return res.json({ success: true, card });
  } catch (error) {
    console.error('Load rate card error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load the rate card', message: error.message });
  }
});

// ═══════════════════════════════════════════
// POST /api/v1/world/:showId/events/:eventId/propose-terms
// ═══════════════════════════════════════════

router.post('/world/:showId/events/:eventId/propose-terms', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { sequelize } = models;

    const premiums = req.body && typeof req.body.premiums === 'object' && req.body.premiums ? req.body.premiums : {};

    const [rows] = await sequelize.query(
      `SELECT id, deal_type, deal_components, career_tier, appearance_required, canon_consequences FROM world_events
        WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL LIMIT 1`,
      { replacements: { eventId, showId } }
    );
    const event = rows?.[0];
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    const lockEpisode = await findTermsWriteLock(sequelize, eventId);
    if (lockEpisode) return res.status(409).json(termsLockedBody(lockEpisode, Object.values(EVENT_COMPONENTS).map((c) => c.field)));

    // D13 (2026-09-30): Propose terms drafts the whole Terms section in one
    // step (dealTermsDraftService.draftTerms) and re-prices every line from
    // the card. A proposal that cannot be made writes nothing (400).
    let proposal;
    try {
      ({ proposal } = await sequelize.transaction((transaction) => draftTerms(sequelize, eventId, {
        transaction, premiums, overwritePrices: true,
      })));
    } catch (draftErr) {
      if (draftErr.status === 400 && draftErr.proposal) {
        return res.status(400).json({ success: false, error: draftErr.proposal.error, errors: draftErr.proposal.errors || [] });
      }
      throw draftErr;
    }
    if (!proposal) return res.status(400).json({ success: false, error: 'Choose a deal type before proposing terms.', errors: [] });

    const [updated] = await sequelize.query(
      'SELECT * FROM world_events WHERE id = :eventId', { replacements: { eventId } }
    );
    return res.json({
      success: true,
      proposal,
      event: updated?.[0] || null,
      deliverables: await listEventDeliverables(sequelize, eventId),
      costs: await listEventCosts(sequelize, eventId),
    });
  } catch (error) {
    console.error('Propose terms error:', error);
    return res.status(500).json({ success: false, error: 'Failed to propose terms', message: error.message });
  }
});

module.exports = router;

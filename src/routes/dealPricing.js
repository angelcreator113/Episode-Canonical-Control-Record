/**
 * Deal pricing routes (deal build PR 3; docs/DEAL_DESIGN.md §3.2, §11.1;
 * Task #2341).
 *
 * GET  /api/v1/deal-rates                                    — the newest rate card (read-only)
 * POST /api/v1/world/:showId/events/:eventId/propose-terms   — draft the deal's numbers
 *
 * Propose terms (Evoni's QUESTION 4 answer, §8(cc): "Rates are baselines,
 * not fixed payouts") runs dealPricingService.proposeTerms and writes the
 * result onto the deal as a draft:
 *   - world_events.appearance_fee and pricing_version;
 *   - event_deliverables.fee, for each deliverable the card prices (a line
 *     with no anchor keeps whatever fee it has).
 * The draft is recorded as the other drafted fields are (doctrine rule 14):
 * automation.auto_drafted.appearance_fee = 'pricing' with its copy in
 * automation.drafted_values, and the priced deliverable fees in
 * automation.drafted_values.deliverable_fees ({ id: fee }). Evoni edits any
 * number through the event PUT and the deliverable PUT until the terms lock;
 * after the lock this route refuses with 409, like every terms write.
 *
 * Body: { premiums: { appearance: [{kind,key}], deliverables: { <id>: [{kind,key}] } } }
 *
 * Location: src/routes/dealPricing.js
 */

'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { listEventDeliverables } = require('../services/eventTermsService');
const { findTermsLockEpisode, termsLockedBody } = require('../utils/eventTermsLock');
const { loadRateCard, proposeTerms, PRICING_SOURCE } = require('../services/dealPricingService');

async function getModels() {
  try { return require('../models'); } catch (err) {
    console.error('[DealPricing] models failed to load:', err.message);
    return null;
  }
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[DealPricing] canon_consequences parse failed:', err.message);
    return fallback;
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
      `SELECT id, deal_type, career_tier FROM world_events
        WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL LIMIT 1`,
      { replacements: { eventId, showId } }
    );
    const event = rows?.[0];
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    const lockEpisode = await findTermsLockEpisode(sequelize, eventId);
    if (lockEpisode) return res.status(409).json(termsLockedBody(lockEpisode, ['appearance_fee']));

    const deliverables = await listEventDeliverables(sequelize, eventId);
    const card = await loadRateCard(sequelize);
    const proposal = proposeTerms({ event, deliverables, premiums, card });
    if (!proposal.ok) return res.status(400).json({ success: false, error: proposal.error, errors: proposal.errors || [] });

    const pricedFees = Object.fromEntries(
      proposal.deliverables.filter((l) => l.fee != null).map((l) => [l.id, l.fee])
    );

    await sequelize.transaction(async (transaction) => {
      const [locked] = await sequelize.query(
        'SELECT canon_consequences FROM world_events WHERE id = :eventId FOR UPDATE',
        { replacements: { eventId }, transaction }
      );
      const cc = parseJson(locked?.[0]?.canon_consequences, {}) || {};
      const automation = cc.automation || {};
      const autoDrafted = { ...(automation.auto_drafted || {}) };
      const draftedValues = { ...(automation.drafted_values || {}) };
      if (proposal.appearance.fee != null) {
        autoDrafted.appearance_fee = PRICING_SOURCE;
        draftedValues.appearance_fee = proposal.appearance.fee;
      }
      if (Object.keys(pricedFees).length) {
        autoDrafted.deliverable_fees = PRICING_SOURCE;
        draftedValues.deliverable_fees = { ...(draftedValues.deliverable_fees || {}), ...pricedFees };
      }
      const nextCc = {
        ...cc,
        automation: { ...automation, auto_drafted: autoDrafted, drafted_values: draftedValues, pricing_version: proposal.pricing_version },
      };
      await sequelize.query(
        `UPDATE world_events
            SET appearance_fee = COALESCE(:appearanceFee, appearance_fee),
                pricing_version = :version,
                canon_consequences = :cc,
                updated_at = NOW()
          WHERE id = :eventId`,
        { replacements: { appearanceFee: proposal.appearance.fee, version: proposal.pricing_version, cc: JSON.stringify(nextCc), eventId }, transaction }
      );
      for (const [id, fee] of Object.entries(pricedFees)) {
        await sequelize.query(
          `UPDATE event_deliverables SET fee = :fee, updated_at = NOW()
            WHERE id = :id AND event_id = :eventId AND deleted_at IS NULL`,
          { replacements: { id, fee, eventId }, transaction }
        );
      }
    });

    const [updated] = await sequelize.query(
      'SELECT * FROM world_events WHERE id = :eventId', { replacements: { eventId } }
    );
    return res.json({
      success: true,
      proposal,
      event: updated?.[0] || null,
      deliverables: await listEventDeliverables(sequelize, eventId),
    });
  } catch (error) {
    console.error('Propose terms error:', error);
    return res.status(500).json({ success: false, error: 'Failed to propose terms', message: error.message });
  }
});

module.exports = router;

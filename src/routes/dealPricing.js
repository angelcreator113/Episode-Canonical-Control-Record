/**
 * Deal pricing routes (deal build PR 3; docs/DEAL_DESIGN.md §3.2, §11.1;
 * Task #2341).
 *
 * GET  /api/v1/deal-rates                                    — the newest rate card (read-only)
 * POST /api/v1/world/:showId/events/:eventId/propose-terms   — draft the deal's numbers
 *
 * Propose terms (Evoni's QUESTION 4 answer, §8(cc): "Rates are baselines,
 * not fixed payouts"; her Deal PR 3 ruling, the same section) runs
 * dealPricingService.proposeTerms and writes the result onto the deal as a
 * draft:
 *   - the event's components the deal type carries (ruling 4):
 *     appearance_fee, partnership_base_fee, performance_fee, and
 *     pricing_version;
 *   - event_deliverables.fee for each deliverable format with an anchor
 *     (ruling 2; since D15 every format but Other);
 *   - the event's extras as event_costs rows, once, while it has none (deal
 *     build PR 4, Task #2365);
 *   - the deal's deliverables, scaled to the job (ruling D12, Task #2395;
 *     dealPricingService.draftDeliverablesForDeal), once: only while the
 *     event has no live deliverable and none were ever drafted, so a
 *     proposal never re-adds a row Evoni deleted. Each drafted row is
 *     recorded in automation.drafted_values.deliverables
 *     ({ <id>: { type, fee, description, required } }) with
 *     automation.auto_drafted.deliverables = 'deal', and reads
 *     "Auto-drafted · from deal" until Evoni edits it.
 * A line with no automatic price (Post, Photo Set, Other, untyped, or an
 * anchor not offered at the tier) keeps whatever number it has and reads
 * "Price required" until Evoni sets one (ruling 6).
 * The draft is recorded as the other drafted fields are (doctrine rule 14):
 * automation.auto_drafted.<field> = 'pricing' with its copy in
 * automation.drafted_values, and the priced deliverable fees in
 * automation.drafted_values.deliverable_fees ({ id: fee }). Evoni edits any
 * number through the event PUT and the deliverable PUT until the terms lock;
 * after the lock this route refuses with 409, like every terms write.
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
const { listEventDeliverables, insertDeliverableRow } = require('../services/eventTermsService');
const { findTermsWriteLock, termsLockedBody } = require('../utils/eventTermsLock');
const {
  loadRateCard, proposeTerms, draftDeliverablesForDeal, PRICING_SOURCE, DRAFTED_DELIVERABLES_SOURCE, EVENT_COMPONENTS,
} = require('../services/dealPricingService');
const { listEventCosts, draftExtrasCosts } = require('../services/eventCostsService');

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
      `SELECT id, deal_type, deal_components, career_tier, appearance_required, canon_consequences FROM world_events
        WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL LIMIT 1`,
      { replacements: { eventId, showId } }
    );
    const event = rows?.[0];
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    const lockEpisode = await findTermsWriteLock(sequelize, eventId);
    if (lockEpisode) return res.status(409).json(termsLockedBody(lockEpisode, Object.values(EVENT_COMPONENTS).map((c) => c.field)));

    const deliverables = await listEventDeliverables(sequelize, eventId);
    const card = await loadRateCard(sequelize);

    // D12: the deal's deliverables, drafted once (see the header). Each
    // draft is proposed under a stand-in id, so the proposal prices it and
    // names its gaps; the stand-in becomes the row's id once it is written.
    const draftsEverRecorded = (cc) => Boolean(cc?.automation?.auto_drafted?.deliverables);
    const drafts = deliverables.length === 0 && !draftsEverRecorded(parseJson(event.canon_consequences, {}))
      ? draftDeliverablesForDeal(event, { card }).map((d, i) => ({ ...d, id: `draft-${i}` }))
      : [];

    const proposal = proposeTerms({ event, deliverables: [...deliverables, ...drafts], premiums, card });
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

      // Written under the row lock, and only if a concurrent write has not
      // added a deliverable or a draft since the check above.
      const idOfDraft = {};
      if (drafts.length && !draftsEverRecorded(cc)
        && (await listEventDeliverables(sequelize, eventId, { transaction })).length === 0) {
        const recorded = { ...(draftedValues.deliverables || {}) };
        for (const d of drafts) {
          const fee = pricedFees[d.id] ?? null;
          const row = await insertDeliverableRow(sequelize, eventId, { ...d, fee }, { transaction });
          if (!row) continue;
          idOfDraft[d.id] = row.id;
          recorded[row.id] = {
            type: d.deliverable_type, platform: d.platform ?? null, quantity: d.quantity ?? 1,
            fee, description: d.description, required: d.required,
          };
        }
        if (Object.keys(idOfDraft).length) {
          autoDrafted.deliverables = DRAFTED_DELIVERABLES_SOURCE;
          draftedValues.deliverables = recorded;
        }
      }
      // A stand-in that was not written is dropped; the rest take their ids.
      for (const id of Object.keys(pricedFees)) {
        if (!id.startsWith('draft-')) continue;
        if (idOfDraft[id]) pricedFees[idOfDraft[id]] = pricedFees[id];
        delete pricedFees[id];
      }
      proposal.deliverables = proposal.deliverables
        .filter((l) => !String(l.id).startsWith('draft-') || idOfDraft[l.id])
        .map((l) => (idOfDraft[l.id] ? { ...l, id: idOfDraft[l.id] } : l));
      const pricedComponents = Object.values(proposal.components).filter((c) => c.fee != null);
      for (const c of pricedComponents) {
        autoDrafted[c.field] = PRICING_SOURCE;
        draftedValues[c.field] = c.fee;
      }
      if (Object.keys(pricedFees).length) {
        autoDrafted.deliverable_fees = PRICING_SOURCE;
        draftedValues.deliverable_fees = { ...(draftedValues.deliverable_fees || {}), ...pricedFees };
      }
      const nextCc = {
        ...cc,
        automation: { ...automation, auto_drafted: autoDrafted, drafted_values: draftedValues, pricing_version: proposal.pricing_version },
      };
      // Only the components the card priced are written; a "Price required"
      // component keeps its number (field names come from EVENT_COMPONENTS,
      // never from the request).
      const setFees = pricedComponents.map((c) => `${c.field} = :${c.field}`).join(', ');
      await sequelize.query(
        `UPDATE world_events
            SET ${setFees ? `${setFees}, ` : ''}pricing_version = :version,
                canon_consequences = :cc,
                updated_at = NOW()
          WHERE id = :eventId`,
        {
          replacements: {
            ...Object.fromEntries(pricedComponents.map((c) => [c.field, c.fee])),
            version: proposal.pricing_version, cc: JSON.stringify(nextCc), eventId,
          },
          transaction,
        }
      );
      for (const [id, fee] of Object.entries(pricedFees)) {
        await sequelize.query(
          `UPDATE event_deliverables SET fee = :fee, updated_at = NOW()
            WHERE id = :id AND event_id = :eventId AND deleted_at IS NULL`,
          { replacements: { id, fee, eventId }, transaction }
        );
      }
      // The event's extras, drafted as cost rows Lala pays (deal build PR 4,
      // Task #2365; DEAL_DESIGN.md §5): once, on a deal whose extras were
      // never drafted and that has no cost rows, so a proposal never re-adds
      // a row Evoni deleted. The Costs "Draft extras" button re-drafts on
      // request.
      const existingCosts = await listEventCosts(sequelize, eventId, { transaction });
      if (!autoDrafted.costs && existingCosts.length === 0) await draftExtrasCosts(sequelize, eventId, { transaction });
    });

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

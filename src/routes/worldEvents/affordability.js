/**
 * World Events routes — affordability and financial pressure
 *
 * GET    /api/v1/world/:showId/events/:eventId/affordability
 * POST   /api/v1/world/:showId/events/:eventId/decline
 * GET    /api/v1/world/:showId/financial-pressure
 * GET    /api/v1/world/:showId/events/:eventId/financial-forecast
 *
 * Part of the worldEvents router (Task #54 split it out of one 5,568-line
 * file); ./index.js mounts the parts in their original order.
 */

'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../../middleware/auth');
const { getModels } = require('./helpers');

// ─── FINANCIAL PRESSURE ENDPOINTS ────────────────────────────────────────────

// GET /world/:showId/events/:eventId/affordability — Can Lala afford this event?
router.get('/world/:showId/events/:eventId/affordability', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();

    // Load event
    const [event] = await models.sequelize.query(
      'SELECT * FROM world_events WHERE id = :eventId LIMIT 1',
      { replacements: { eventId }, type: models.sequelize.QueryTypes.SELECT }
    );
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    // Get Lala's current balance
    // The ledger balance, as GET /world/:showId/balance reads it (F-Stats-1
    // v1.63 §66.3-F). getCurrentBalance has its own fallbacks; anything it
    // throws reaches the outer catch, which logs.
    const { getCurrentBalance } = require('../../services/financialTransactionService');
    const balance = await getCurrentBalance(models.sequelize, showId);

    const { checkAffordability } = require('../../services/financialPressureService');
    const result = checkAffordability(event, balance);

    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[affordability] failed:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /world/:showId/events/:eventId/decline — Decline event and track as missed opportunity
router.post('/world/:showId/events/:eventId/decline', requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { reason } = req.body;
    const models = await getModels();

    const [event] = await models.sequelize.query(
      'SELECT * FROM world_events WHERE id = :eventId LIMIT 1',
      { replacements: { eventId }, type: models.sequelize.QueryTypes.SELECT }
    );
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    if (typeof event.canon_consequences === 'string') {
      try { event.canon_consequences = JSON.parse(event.canon_consequences); } catch { event.canon_consequences = {}; }
    }

    const { recordDeclinedInvite } = require('../../services/financialPressureService');
    const declined = await recordDeclinedInvite(event, reason || 'not specified', models);

    return res.json({ success: true, declined, message: `"${event.name}" declined — tracked for future callbacks` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /world/:showId/financial-pressure — Get financial pressure context for script writing
router.get('/world/:showId/financial-pressure', requireAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const models = await getModels();

    // Get Lala's balance
    // The ledger balance, as GET /world/:showId/balance reads it (F-Stats-1
    // v1.63 §66.3-F). getCurrentBalance has its own fallbacks; anything it
    // throws reaches the outer catch, which logs.
    const { getCurrentBalance } = require('../../services/financialTransactionService');
    const balance = await getCurrentBalance(models.sequelize, showId);

    // Get declined invites
    let declinedInvites = [];
    try {
      const [rows] = await models.sequelize.query(
        `SELECT name, canon_consequences FROM world_events WHERE show_id = :showId AND status = 'declined' AND deleted_at IS NULL`,
        { replacements: { showId } }
      );
      declinedInvites = rows.map(r => {
        const cc = typeof r.canon_consequences === 'string' ? JSON.parse(r.canon_consequences) : r.canon_consequences;
        return cc?.declined || { event_name: r.name };
      });
    } catch (err) {
      // A fallback: every column here exists in canon (capture 2026-09-17), so this fires only on a real error.
      console.error('[financial-pressure] declined invites query failed:', err.message);
    }

    // Get pending opportunities
    let pendingOpps = [];
    try {
      const [rows] = await models.sequelize.query(
        `SELECT name, status, payment_amount FROM opportunities WHERE show_id = :showId AND deleted_at IS NULL AND status IN ('booked','preparing','active','completed')`,
        { replacements: { showId } }
      );
      pendingOpps = rows;
    } catch (err) {
      // A fallback: the table and its columns exist in canon (capture 2026-09-17).
      console.error('[financial-pressure] opportunities query failed:', err.message);
    }

    // Get recent transactions (from episode financials)
    let transactions = [];
    try {
      const [rows] = await models.sequelize.query(
        `SELECT total_income, total_expenses, title FROM episodes WHERE show_id = :showId AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 10`,
        { replacements: { showId } }
      );
      transactions = rows.flatMap(r => [
        ...(parseFloat(r.total_income) > 0 ? [{ type: 'income', amount: parseFloat(r.total_income), source: r.title }] : []),
        ...(parseFloat(r.total_expenses) > 0 ? [{ type: 'expense', amount: parseFloat(r.total_expenses), source: r.title }] : []),
      ]);
    } catch (err) {
      // A fallback: every column here exists in canon (capture 2026-09-17).
      console.error('[financial-pressure] episode financials query failed:', err.message);
    }

    const { buildFinancialPressureContext } = require('../../services/financialPressureService');
    const context = buildFinancialPressureContext(balance, transactions, declinedInvites, pendingOpps);

    return res.json({ success: true, ...context });
  } catch (err) {
    console.error('[financial-pressure] failed:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /world/:showId/events/:eventId/financial-forecast
// Real-coin forecast for the event's financial impact. Replaces the static
// tier-table estimate that previously lived inline in WorldAdmin's Financial
// Preview card. Sources are honest about where each number came from:
//
//   income   = event_payment  + content_revenue_est (ticked tasks pay no
//              coins: §8(bb) T3, Task #2263)
//   expenses = event_cost     + outfit_retail (owned) + outfit_rentals
//                             + drinks_est + valet_est + photo_booth_est
//
// If no outfit is picked, outfit_retail falls back to a prestige-tiered
// estimate so the UI isn't blank on a fresh event. The Show's live balance
// + goal ladder are included so the frontend can render a single combined
// "can she afford this, and does this push her toward her next goal" view.
router.get('/world/:showId/events/:eventId/financial-forecast', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    // Event row — raw SQL to tolerate unmigrated columns on older envs.
    let event = null;
    try {
      const [eventRows] = await models.sequelize.query(
        `SELECT id, name, prestige, event_type, cost_coins, is_paid, is_free, payment_amount,
                outfit_pieces, canon_consequences, dress_code, format, rewards, deal_type, deal_components,
                host, host_brand, appearance_fee, partnership_base_fee, performance_fee,
                appearance_required, bonus_terms
         FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1`,
        { replacements: { eventId, showId } }
      );
      event = eventRows?.[0] || null;
    } catch (err) {
      if (err?.original?.code !== '42703' && !String(err?.message || '').includes('is_free')) throw err;
      const [fallbackRows] = await models.sequelize.query(
        `SELECT id, name, prestige, event_type, cost_coins, is_paid, payment_amount,
                outfit_pieces, canon_consequences, dress_code, format, rewards, deal_type, deal_components,
                host, host_brand, appearance_fee, partnership_base_fee, performance_fee,
                appearance_required, bonus_terms
         FROM world_events WHERE id = :eventId AND show_id = :showId LIMIT 1`,
        { replacements: { eventId, showId } }
      );
      event = fallbackRows?.[0] ? {
        ...fallbackRows[0],
        is_free: fallbackRows[0].is_paid === 'free',
      } : null;
    }
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    const prestige = Number(event.prestige) || 5;
    const outfitPieces = (() => {
      if (!event.outfit_pieces) return [];
      if (Array.isArray(event.outfit_pieces)) return event.outfit_pieces;
      try { return JSON.parse(event.outfit_pieces); } catch { return []; }
    })();

    const {
      USD_TO_COINS, RENTAL_RATE,
    } = require('../../utils/financialRates');
    const {
      getCurrentBalance, getFinancialGoals,
    } = require('../../services/financialTransactionService');

    // ── Outfit costs ────────────────────────────────────────────────
    // Real data when an outfit has been picked; otherwise a prestige-tier
    // fallback so a fresh event still shows a plausible number. Rentals +
    // borrowed items cost a fraction of retail (RENTAL_RATE).
    let outfitRetail = 0;
    let outfitRentals = 0;
    let outfitSource = 'none';
    if (outfitPieces.length > 0) {
      outfitSource = 'actual';
      for (const p of outfitPieces) {
        const price = (parseFloat(p.price) || 0) * USD_TO_COINS;
        if (p.acquisition_type === 'rented' || p.acquisition_type === 'borrowed') {
          outfitRentals += Math.round(price * RENTAL_RATE);
        } else {
          outfitRetail += Math.round(price);
        }
      }
    } else {
      outfitSource = 'estimate';
      outfitRetail = prestige >= 8 ? 8000 : prestige >= 6 ? 3500 : prestige >= 4 ? 1200 : 400;
    }

    // ── Event extras (drinks / valet / photo booth) ──────────────────
    // A deal event (deal build PR 4, Task #2365) has no cost_coins entry
    // charge: its terms costs are its itemised event_costs rows, as Finalize
    // charges them. A legacy event keeps the entry cost.
    // The extras are event spending since the event cost split (2026-09-30):
    // Start Episode drafts them as Money tab lines and Complete charges
    // them, for every event, so they are estimated here for every event,
    // except a deal event that still has extras cost rows (drafted before
    // the split; Start Episode carries them into spending): those rows are
    // the estimate.
    const { normalizePaidFreeFlags } = require('../../utils/paidFreeFlags');
    const { isDeal, eventCost } = normalizePaidFreeFlags(event);
    let drinks = 0;
    let valet = 0;
    let photoBooth = 0;
    let itemised = null;
    if (isDeal) {
      const { listEventCosts, costTotals } = require('../../services/eventCostsService');
      const costs = await listEventCosts(models.sequelize, event.id);
      const totals = costTotals(costs);
      itemised = {
        costs: costs.map((c) => ({ id: c.id, kind: c.kind, label: c.label, amount: c.amount, paid_by: c.paid_by })),
        lala_total: totals.lala,
        comped_total: totals.comped,
      };
    }
    if (!isDeal || !itemised.costs.some((c) => c.kind === 'extras')) {
      // The same extras Start Episode drafts (financialRates.eventExtrasFor:
      // the photo booth only on galas, premieres, launches, brand deals or a
      // red-carpet or photo dress code).
      const { eventExtrasFor } = require('../../utils/financialRates');
      ({ drinks, valet, photo_booth: photoBooth } = eventExtrasFor(event));
    }

    // ── Income side ─────────────────────────────────────────────────
    // A legacy event: payment_amount when paid, plus the 10% brand-deal
    // content fee finalize-financials books (no delivery is checked, Task
    // #1808). A deal event (deal build PR 5; dealPayoutService): its
    // components, paid at Complete, and its deliverables' content fees,
    // paid on approval; normalizePaidFreeFlags gives it no payment_amount.
    const { eventPayment } = normalizePaidFreeFlags(event);
    const contentRevenueEst = (event.event_type === 'brand_deal' && eventPayment > 0)
      ? Math.round(eventPayment * 0.1)
      : 0;
    let dealComponentsTotal = 0;
    let contentFeesTotal = 0;
    if (isDeal) {
      const { completionPayouts, contentFeeFor } = require('../../services/dealPayoutService');
      const { listEventDeliverables } = require('../../services/eventTermsService');
      dealComponentsTotal = completionPayouts(event, null).reduce((sum, p) => sum + p.amount, 0);
      const deliverables = await listEventDeliverables(models.sequelize, event.id);
      contentFeesTotal = deliverables.reduce((sum, d) => sum + contentFeeFor(event, d), 0);
    }

    const income = {
      event_payment: eventPayment,
      content_revenue_est: contentRevenueEst,
      deal_components: dealComponentsTotal,
      content_fees: contentFeesTotal,
      total: eventPayment + contentRevenueEst + dealComponentsTotal + contentFeesTotal,
    };

    // ── Tier-dependent bonuses (forecast only) ──────────────────────────
    // Only a deal's contractual bonus (bonus_terms, by evaluation tier) now
    // depends on the tier. The generic tier reward, the paid bonus and the
    // event reward are retired for every completion (Q12 and Evoni's
    // follow-ups, EVENT_EPISODE_FLOW.md §8(cc); deal build PR 5), so a legacy
    // event's tiers all add 0.
    const { normalizeBonusTerms } = require('../../services/dealPayoutService');
    const bonusTerms = (isDeal && normalizeBonusTerms(event.bonus_terms).value) || {};
    const tierBonuses = Object.fromEntries(['slay', 'pass', 'safe', 'fail'].map((tier) => {
      const dealBonus = tier === 'fail' ? 0 : (bonusTerms[tier] || 0);
      return [tier, { deal_bonus: dealBonus, total: dealBonus }];
    }));
    const itemisedLala = itemised ? itemised.lala_total : 0;
    const expenses = {
      event_cost: eventCost,
      outfit_retail: outfitRetail,
      outfit_rentals: outfitRentals,
      drinks_est: drinks,
      valet_est: valet,
      photo_booth_est: photoBooth,
      // A deal event's itemised costs (Task #2365): Lala's rows count here;
      // comped rows are listed, never counted.
      itemised,
      total: eventCost + outfitRetail + outfitRentals + drinks + valet + photoBooth + itemisedLala,
    };
    const net = income.total - expenses.total;

    // ── Balance + milestones ────────────────────────────────────────
    const [balance, goals] = await Promise.all([
      getCurrentBalance(models.sequelize, showId),
      getFinancialGoals(models.sequelize, showId),
    ]);
    const balanceAfter = balance + net;
    const sortedGoals = [...goals].sort((a, b) => (a.threshold || 0) - (b.threshold || 0));
    const nextGoal = sortedGoals.find(g => !g.triggered_at) || null;
    // Pressure tiers drive feed tone + Lala mood downstream. "high" = event
    // would drop her below 25% of the next-goal threshold; "medium" = below
    // 50%; "low" = above. Falls back to flat "ok" when no goal ladder is set.
    const affordability = {
      can_afford: balanceAfter >= 0,
      balance_before: balance,
      balance_after: balanceAfter,
      pressure: !nextGoal ? 'ok'
        : balanceAfter < nextGoal.threshold * 0.25 ? 'high'
        : balanceAfter < nextGoal.threshold * 0.5  ? 'medium'
        : 'low',
    };

    // Optimistic / realistic balance projections — adds the tier-bonus
    // total on top of the always-pays net so the preview shows what
    // SLAY or PASS would actually deposit. Frontend renders SLAY as the
    // optimistic ceiling, PASS as the realistic.
    const balanceAfterIfSlay = balanceAfter + tierBonuses.slay.total;
    const balanceAfterIfPass = balanceAfter + tierBonuses.pass.total;

    return res.json({
      success: true,
      currency: 'coins',
      event: { id: event.id, name: event.name, prestige, event_type: event.event_type },
      income,
      expenses,
      net,
      tier_bonuses: tierBonuses,
      projected_balance: {
        baseline: balanceAfter,                 // always-pays only (current behavior)
        if_pass: balanceAfterIfPass,            // realistic: PASS lands all bonuses
        if_slay: balanceAfterIfSlay,            // optimistic: SLAY ceiling
      },
      affordability,
      next_goal: nextGoal,
      outfit_source: outfitSource,
      outfit_piece_count: outfitPieces.length,
    });
  } catch (err) {
    console.error('[financial-forecast] error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

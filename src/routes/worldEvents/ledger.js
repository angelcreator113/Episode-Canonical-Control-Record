/**
 * World Events routes — episode completion and money
 *
 * POST   /api/v1/world/:showId/episodes/:episodeId/complete
 * POST   /api/v1/world/:showId/episodes/:episodeId/finalize-financials
 * GET    /api/v1/world/:showId/financial-ledger
 * GET    /api/v1/world/:showId/episodes/:episodeId/money
 * GET    /api/v1/world/:showId/events/:eventId/money-preview
 * GET    /api/v1/world/:showId/balance
 * POST   /api/v1/world/:showId/events/:eventId/generate-lists
 *
 * Part of the worldEvents router (Task #54 split it out of one 5,568-line
 * file); ./index.js mounts the parts in their original order.
 */

'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../../middleware/auth');
const { aiRateLimiter } = require('../../middleware/aiRateLimiter');
const { TermsReopenedError, termsReopenedBody } = require('../../utils/eventTermsLock');
const { loadScopedEvent } = require('../../utils/eventScope');
const { loadMoneyPreview } = require('./helpers');

// ═══════════════════════════════════════════════════════════════════════
// UNIFIED EPISODE COMPLETION — evaluate + financials + social + wardrobe in one
// ═══════════════════════════════════════════════════════════════════════

// POST /world/:showId/episodes/:episodeId/complete
router.post('/world/:showId/episodes/:episodeId/complete', requireAuth, async (req, res) => {
  try {
    const { showId, episodeId } = req.params;
    const models = req.app?.get?.('models') || require('../../models');
    const { completeEpisode } = require('../../services/episodeCompletionService');

    const result = await completeEpisode(episodeId, showId, models.sequelize);

    return res.json({
      success: true,
      message: result.already_completed
        ? 'Episode already completed'
        : `${result.evaluation.tier.toUpperCase()} (${result.evaluation.score}/100) — ${result.transactions} transactions, ${result.social_tasks?.completed || 0} social tasks`,
      data: result,
    });
  } catch (err) {
    console.error('[CompleteEpisode] Error:', err);
    // Task #2378: nothing books while the event's terms are reopened.
    if (err instanceof TermsReopenedError) return res.status(err.status).json(termsReopenedBody(err));
    // Task #1933: completion refuses a result that would take coins below zero.
    const { InsufficientCoinsError, insufficientCoinsBody } = require('../../services/coinBalanceGuard');
    if (err instanceof InsufficientCoinsError) {
      return res.status(err.status).json(insufficientCoinsBody(err));
    }
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// FINANCIAL TRANSACTION PIPELINE — execute, query, and display finances
// ═══════════════════════════════════════════════════════════════════════

// POST /world/:showId/episodes/:episodeId/finalize-financials
router.post('/world/:showId/episodes/:episodeId/finalize-financials', requireAuth, async (req, res) => {
  try {
    const { showId, episodeId } = req.params;
    const models = req.app?.get?.('models') || require('../../models');
    const { finalizeEpisodeFinancials } = require('../../services/financialTransactionService');

    const result = await finalizeEpisodeFinancials(episodeId, showId, models.sequelize);

    return res.json({
      success: true,
      message: result.already_finalized
        ? 'Episode already finalized'
        : `${result.transactions.length} transactions executed — balance: ${result.balance_after}`,
      data: result,
    });
  } catch (err) {
    // §8(y) Q6 (Task #2247): a finalize that would take Lala below zero is
    // refused with the same 400 as Complete, and writes nothing.
    // Task #2378: nothing books while the event's terms are reopened.
    if (err instanceof TermsReopenedError) {
      console.error('[Financials] Finalize refused, terms reopened:', err.message);
      return res.status(err.status).json(termsReopenedBody(err));
    }
    const { InsufficientCoinsError, insufficientCoinsBody } = require('../../services/coinBalanceGuard');
    if (err instanceof InsufficientCoinsError) {
      return res.status(err.status).json(insufficientCoinsBody(err));
    }
    console.error('[Financials] Finalize error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /world/:showId/financial-ledger — running ledger across all episodes
router.get('/world/:showId/financial-ledger', requireAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { episode_id, limit = 100 } = req.query;
    const models = req.app?.get?.('models') || require('../../models');
    const { getFinancialLedger } = require('../../services/financialTransactionService');

    const result = await getFinancialLedger(showId, models.sequelize, {
      episodeId: episode_id || null,
      limit: parseInt(limit),
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Financials] Ledger error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /world/:showId/episodes/:episodeId/money — Episode Money, Phase A
// (§8(aa) M1–M5; Task #2278): the balance, the episode's posted ledger rows
// and net, and the source event's terms as expected lines. Read-only.
router.get('/world/:showId/episodes/:episodeId/money', requireAuth, async (req, res) => {
  try {
    const { showId, episodeId } = req.params;
    const models = req.app?.get?.('models') || require('../../models');
    const { getEpisodeMoney } = require('../../services/episodeMoneyService');
    const money = await getEpisodeMoney(models.sequelize, { showId, episodeId });
    if (!money) return res.status(404).json({ success: false, error: 'Episode not found' });
    return res.json({ success: true, data: money });
  } catch (err) {
    console.error('[Financials] Episode money error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});


// GET /world/:showId/events/:eventId/money-preview — Episode Money Phase B,
// MB4 (§8(gg)): before Start Episode, the event's plan as money lines, the
// projection and the early warnings against Lala's ledger balance.
// Read-only; it never blocks Start Episode.
router.get('/world/:showId/events/:eventId/money-preview', requireAuth, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const models = req.app?.get?.('models') || require('../../models');
    const preview = await loadMoneyPreview(models.sequelize, { showId, eventId });
    if (!preview) return res.status(404).json({ success: false, error: 'Event not found' });
    return res.json({ success: true, data: preview });
  } catch (err) {
    console.error('[Financials] Event money preview error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /world/:showId/balance — current coin balance
router.get('/world/:showId/balance', requireAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const models = req.app?.get?.('models') || require('../../models');
    const { getCurrentBalance } = require('../../services/financialTransactionService');
    const { checkAffordability } = require('../../services/financialPressureService');

    const balance = await getCurrentBalance(models.sequelize, showId);
    // ?episode_id=: also the balance before that episode, which the Script
    // tab's "True at beat N" card starts from (Task #2882).
    const episodeId = typeof req.query.episode_id === 'string' ? req.query.episode_id : null;
    if (episodeId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(episodeId)) {
      return res.status(400).json({ success: false, error: 'episode_id must be a UUID' });
    }
    const balanceBeforeEpisode = episodeId
      ? await require('../../services/financialTransactionService').getBalanceBeforeEpisode(models.sequelize, showId, episodeId)
      : undefined;

    // Get pending event (next ready event) for affordability check
    let affordability = null;
    try {
      const [nextEvent] = await models.sequelize.query(
        `SELECT * FROM world_events WHERE show_id = :showId AND status = 'ready' ORDER BY created_at LIMIT 1`,
        { replacements: { showId }, type: models.sequelize.QueryTypes.SELECT }
      );
      if (nextEvent) affordability = checkAffordability(nextEvent, balance);
    } catch (err) { console.error('[WorldEvents] balance affordability check failed (non-blocking):', err.message); }

    return res.json({ success: true, balance, affordability, ...(episodeId ? { balance_before_episode: balanceBeforeEpisode } : {}) });
  } catch (err) {
    console.error('[WorldEvents] GET /balance failed:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /world/:showId/events/:eventId/generate-lists — generate wardrobe + career lists from event
router.post('/world/:showId/events/:eventId/generate-lists', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { showId, eventId } = req.params;
    const { listType = 'both' } = req.body; // 'wardrobe', 'career', or 'both'
    const models = req.app?.get?.('models') || require('../../models');
    const { sequelize } = models;

    // Find the episode linked to this event
    const event = await loadScopedEvent(sequelize, { showId, eventId, columns: 'id, name, used_in_episode_id' });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (!event.used_in_episode_id) return res.status(400).json({ error: 'Event not injected into an episode yet. Inject the event first.' });

    const episodeId = event.used_in_episode_id;
    const results = {};

    // Generate wardrobe shopping list
    if (listType === 'wardrobe' || listType === 'both') {
      try {
        const { generateEpisodeTodoList } = require('../../services/todoListService');
        const wardrobeResult = await generateEpisodeTodoList(episodeId, showId, models);
        results.wardrobe = { success: true, tasks: wardrobeResult.tasks.length, assetUrl: wardrobeResult.assetUrl };
      } catch (err) {
        results.wardrobe = { success: false, error: err.message };
      }
    }

    // Generate career checklist
    if (listType === 'career' || listType === 'both') {
      try {
        const { generateCareerList } = require('../../services/todoListService');
        const careerResult = await generateCareerList(episodeId, showId, models);
        results.career = { success: true, tasks: careerResult.tasks.length, assetUrl: careerResult.assetUrl };
      } catch (err) {
        results.career = { success: false, error: err.message };
      }
    }

    return res.json({
      success: true,
      event_name: event.name,
      episode_id: episodeId,
      lists: results,
    });
  } catch (err) {
    console.error('[WorldEvents] Generate lists error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

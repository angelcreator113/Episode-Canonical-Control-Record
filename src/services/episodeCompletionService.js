'use strict';

/**
 * Episode Completion Service — Unified Pipeline
 *
 * Merges evaluation, financials, social tasks, and wardrobe intelligence
 * into a single completion flow. Replaces the 3-step manual process
 * (evaluate → accept → finalize-financials) with one call.
 *
 * Flow:
 *   1. Evaluate (compute score from outfit + event + character state)
 *   2. Apply social task bonuses (reputation, influence from completions)
 *   3. Apply wardrobe intelligence (brand_trust from brands, stress from affordability)
 *   4. Compute final tier (SLAY/PASS/SAFE/FAIL)
 *   5. Finalize financials (tier rewards + real costs as transactions)
 *   6. Merge all stat deltas into one write
 *   7. Record full snapshot to character_state_history with evaluation_id
 */

const { v4: uuidv4 } = require('uuid');
const {
  evaluate,
  computeStatDeltas,
  applyDeltas,
  generateNarrativeLine,
  FORMULA_VERSION,
} = require('../utils/evaluationFormula');
const { changeCoins, InsufficientCoinsError } = require('./coinBalanceGuard');
const { EPISODE_EVENT_SQL, LALA_STATE_SQL, DEFAULT_LALA_STATE, buildOutfitScoreContext } = require('./outfitScoreContext');
const { isSocialTaskRequired } = require('../utils/socialTaskSource');

// ─── SOCIAL TASK STAT BONUSES ────────────────────────────────────────────────
// Completing social tasks should affect more than just coins

function computeSocialTaskBonuses(socialTasks) {
  if (!Array.isArray(socialTasks) || socialTasks.length === 0) return {};

  const completed = socialTasks.filter(t => t.completed);
  const total = socialTasks.length;
  const completionRate = total > 0 ? completed.length / total : 0;
  // Ruling (Evoni, 2026-09-29, T1 §8(bb); Task #2292): a required task
  // changes Lala's state only when it traces to an accepted required
  // deliverable — the deliverable_id Start Episode stamps from the event's
  // deliverable row (never read here). A legacy or template task whose only basis is
  // required: true is not an obligation here: it moves neither stress nor
  // the all-required influence bonus. It still counts toward completion.
  const requiredDone = socialTasks.filter(t => isSocialTaskRequired(t) && t.completed).length;
  const requiredTotal = socialTasks.filter(isSocialTaskRequired).length;
  const allRequiredDone = requiredTotal > 0 && requiredDone === requiredTotal;

  const bonuses = {};

  // Reputation: completing social tasks = visible effort = reputation gain
  if (completionRate >= 0.8) bonuses.reputation = 1;
  else if (completionRate < 0.3 && total > 3) bonuses.reputation = -1;

  // Influence: social media presence = influence
  if (allRequiredDone) bonuses.influence = 1;
  if (completionRate >= 0.9) bonuses.influence = (bonuses.influence || 0) + 1;

  // Stress: not completing required tasks = stress
  if (requiredTotal > 0 && !allRequiredDone) bonuses.stress = 1;
  else if (allRequiredDone && completionRate >= 0.7) bonuses.stress = -1;

  return {
    deltas: bonuses,
    detail: {
      completed: completed.length,
      total,
      completion_rate: Math.round(completionRate * 100),
      required_done: requiredDone,
      required_total: requiredTotal,
      all_required_done: allRequiredDone,
    },
  };
}

// ─── WARDROBE INTELLIGENCE BONUSES ───────────────────────────────────────────
// Outfit details that should affect character stats beyond the match score

function computeWardrobeBonuses(outfitPieces, event) {
  if (!Array.isArray(outfitPieces) || outfitPieces.length === 0) return {};

  const bonuses = {};
  const brands = [...new Set(outfitPieces.map(p => p.brand).filter(Boolean))];
  const tiers = outfitPieces.map(p => p.tier).filter(Boolean);
  const totalCost = outfitPieces.reduce((s, p) => s + (parseFloat(p.price) || 0), 0);
  const prestige = event?.prestige || 5;

  // Brand trust: wearing identifiable brands to events builds trust
  if (brands.length >= 2) bonuses.brand_trust = 1;
  // Wearing the host's brand = extra trust
  if (event?.host_brand && brands.some(b => b.toLowerCase().includes(event.host_brand.toLowerCase()))) {
    bonuses.brand_trust = (bonuses.brand_trust || 0) + 1;
  }

  // Tier alignment: outfit tier vs event prestige
  const avgTierScore = tiers.reduce((s, t) => s + ({ basic: 1, mid: 2, luxury: 3, elite: 4 }[t] || 2), 0) / (tiers.length || 1);
  const expectedTier = prestige >= 8 ? 3.5 : prestige >= 6 ? 2.5 : prestige >= 4 ? 1.5 : 1;
  const tierGap = avgTierScore - expectedTier;

  // Overdressed for a casual event = confidence boost but slight stress
  if (tierGap > 1.5) {
    bonuses.stress = (bonuses.stress || 0) + 1;
  }
  // Underdressed for a prestige event = stress and reputation hit
  if (tierGap < -1 && prestige >= 6) {
    bonuses.stress = (bonuses.stress || 0) + 1;
    bonuses.reputation = (bonuses.reputation || 0) - 1;
  }

  // Financial pressure: spending too much relative to the event
  if (totalCost > 500 && prestige <= 4) {
    bonuses.stress = (bonuses.stress || 0) + 1; // overspending on a low-stakes event
  }

  return {
    deltas: bonuses,
    detail: {
      brands,
      avg_tier_score: Math.round(avgTierScore * 10) / 10,
      expected_tier: expectedTier,
      tier_gap: Math.round(tierGap * 10) / 10,
      total_outfit_cost: totalCost,
    },
  };
}

// ─── THE EPISODE'S LOOK (Task #1924) ─────────────────────────────────────────
// Before #1924 the look query named approval_status and deleted_at, neither
// of which episode_wardrobe had (Evoni's production read, ATTESTED
// 2026-09-25), so it failed into a silent catch and the wardrobe bonuses
// were scored on the event's outfit_pieces every time, with nothing in the
// result saying so.
//
// Evoni's rulings (2026-09-25): when the episode has no approved look, both
// the wardrobe bonuses and the outfit match (outfit_match, accessory_match)
// are scored on the event's pieces, and the result says so
// (outfit.source 'event_pieces', outfit.label, outfit.match_scored). "An
// episode scored on the event's pieces and *told* so beats an episode
// silently scoring zero." Before #1924 the match scored 0 for every episode.
// EVENT_PIECES_FALLBACK covers both: false means no look, no wardrobe
// bonuses and no outfit match (outfit.source 'none').
const EVENT_PIECES_FALLBACK = true;
const EVENT_PIECES_LABEL = "scored on the event's pieces";
const NO_LOOK_LABEL = 'no approved look; not scored for outfit';

function parseEventPieces(event) {
  if (!event?.outfit_pieces) return [];
  try {
    const pieces = typeof event.outfit_pieces === 'string' ? JSON.parse(event.outfit_pieces) : event.outfit_pieces;
    return Array.isArray(pieces) ? pieces : [];
  } catch (parseErr) {
    console.error('[episodeCompletion] event outfit_pieces is not valid JSON:', parseErr?.message);
    return [];
  }
}

/**
 * The approved, not-removed episode_wardrobe rows of an episode, or (with
 * eventPiecesFallback, default EVENT_PIECES_FALLBACK) the event's pieces,
 * labelled as such. completeEpisode scores both the wardrobe bonuses and the
 * outfit match on whatever this returns, so the one value decides both.
 *
 * @returns {Promise<{ pieces: object[], outfit: { source: 'episode_look'|'event_pieces'|'none',
 *   label: string|null, pieces: number, reason: string|null, match_scored: boolean } }>}
 */
async function loadEpisodeLook(sequelize, episodeId, event, { eventPiecesFallback = EVENT_PIECES_FALLBACK } = {}) {
  let reason = 'no_approved_look';
  try {
    const rows = await sequelize.query(
      `SELECT w.brand, w.name, w.price, w.tier, w.clothing_category AS category
       FROM episode_wardrobe ew
       JOIN wardrobe w ON w.id = ew.wardrobe_id AND w.deleted_at IS NULL
       WHERE ew.episode_id = :episodeId AND ew.approval_status = 'approved' AND ew.deleted_at IS NULL`,
      { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
    );
    if (rows && rows.length) {
      return { pieces: rows, outfit: { source: 'episode_look', label: null, pieces: rows.length, reason: null, match_scored: false } };
    }
  } catch (lookErr) {
    reason = 'look_query_failed';
    console.error(`[episodeCompletion] episode ${episodeId}: the look query failed:`, lookErr?.message);
  }

  const eventPieces = eventPiecesFallback ? parseEventPieces(event) : [];
  if (eventPieces.length) {
    console.warn(`[episodeCompletion] episode ${episodeId}: ${reason}; outfit match and wardrobe bonuses ${EVENT_PIECES_LABEL} (${eventPieces.length})`);
    return { pieces: eventPieces, outfit: { source: 'event_pieces', label: EVENT_PIECES_LABEL, pieces: eventPieces.length, reason, match_scored: false } };
  }
  console.warn(`[episodeCompletion] episode ${episodeId}: ${reason}; ${NO_LOOK_LABEL}`);
  return { pieces: [], outfit: { source: 'none', label: NO_LOOK_LABEL, pieces: 0, reason, match_scored: false } };
}

// ─── MAIN: COMPLETE EPISODE ──────────────────────────────────────────────────

// options.eventPiecesFallback overrides EVENT_PIECES_FALLBACK for one call
// (tests); callers pass nothing.
async function completeEpisode(episodeId, showId, sequelize, { eventPiecesFallback = EVENT_PIECES_FALLBACK } = {}) {
  // ── 1. Load episode ──
  const [episode] = await sequelize.query(
    `SELECT id, title, episode_number, show_id, evaluation_json, evaluation_status, total_income, total_expenses
     FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1`,
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  );
  if (!episode) throw new Error('Episode not found');

  // Check if already completed
  if (episode.evaluation_status === 'accepted') {
    return { already_completed: true, message: 'Episode already completed', evaluation: episode.evaluation_json };
  }

  // Reopened terms (Reopen ruling, §8(cc); Task #2378): refused before any
  // write. Finalize checks again under the episode lock.
  const { assertEpisodeTermsNotReopened } = require('../utils/eventTermsLock');
  await assertEpisodeTermsNotReopened(sequelize, episodeId);

  // ── 2. Load event (prefer highest prestige for multi-event episodes) ──
  // EPISODE_EVENT_SQL is shared with the styling game's score (Task #1943).
  const [event] = await sequelize.query(
    EPISODE_EVENT_SQL,
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  ).catch(() => []);

  // The episode's look: its approved episode_wardrobe rows (Task #1924).
  // Never the event's pieces without saying so — see loadEpisodeLook.
  const look = await loadEpisodeLook(sequelize, episodeId, event, { eventPiecesFallback });
  const outfitPieces = look.pieces;

  // ── 3. Load social tasks ──
  let socialTasks = [];
  try {
    const [todoList] = await sequelize.query(
      `SELECT social_tasks FROM episode_todo_lists WHERE episode_id = :episodeId AND deleted_at IS NULL LIMIT 1`,
      { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
    );
    if (todoList?.social_tasks) {
      socialTasks = typeof todoList.social_tasks === 'string' ? JSON.parse(todoList.social_tasks) : todoList.social_tasks;
    }
  } catch { /* non-blocking */ }

  // ── 4. Get current character state ──
  // Canonical character_key is 'lala' (F-Sec-3 decision; Task #1816).
  let characterState;
  const [existingState] = await sequelize.query(
    LALA_STATE_SQL,
    { replacements: { showId }, type: sequelize.QueryTypes.SELECT }
  ).catch(() => []);

  if (existingState) {
    characterState = existingState;
  } else {
    // Auto-seed. D1 (design §6.6; §8(y) Q1; Task #2249): the row is created
    // and its coins synced from the ledger (seeded with the show's
    // starting_balance, default 1900) in one transaction, so it never holds
    // an independent 500.
    const stateId = uuidv4();
    const { syncCoinsFromLedger } = require('./coinLedgerSync');
    let coins;
    await sequelize.transaction(async (seedTx) => {
      await sequelize.query(
        `INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
         VALUES (:id, :showId, 'lala', :coins, :reputation, :brand_trust, :influence, :stress, NOW(), NOW())`,
        { replacements: { id: stateId, showId, ...DEFAULT_LALA_STATE }, transaction: seedTx }
      );
      ({ balance: coins } = await syncCoinsFromLedger(sequelize, showId, { transaction: seedTx }));
    });
    characterState = { id: stateId, ...DEFAULT_LALA_STATE, coins };
  }

  // ── 5. Get outfit score for evaluation ──
  let outfitMatch = 0, accessoryMatch = 0;
  try {
    const { getOutfitScore } = require('../routes/wardrobe');
    if (typeof getOutfitScore === 'function') {
      const models = require('../models');
      // Pass characterState so the scorer can run evaluateCharacterMoodFit
      // (stress + reputation modulate the outfit signal). Also pass the
      // wardrobe arc stage so evaluateAuthenticityFit can penalize tier
      // overreach (foundation Lala in elite outfit reads as unearned).
      // Task #1943: built by buildOutfitScoreContext, which the styling
      // game's score (/outfit-score) uses too, so the two numbers agree.
      const { eventContext, arcStage } = await buildOutfitScoreContext({ models, showId, event, characterState });
      // Task #1924: the same pieces as `look` — the approved look, or the
      // event's pieces when look.outfit.source says so (EVENT_PIECES_FALLBACK).
      const matchOptions = look.outfit.source === 'event_pieces' ? { pieces: look.pieces } : { approvedOnly: true };
      const outfitResult = await getOutfitScore(models, episodeId, eventContext, characterState, arcStage, matchOptions);
      // Outfit match scaled to the 0-35 cap (formerly 0-25). Score is 0-100
      // from scoreOutfitForEvent; multiply by 0.35 to use the full new range.
      outfitMatch = Math.round((outfitResult?.score || 0) * 0.35);
      accessoryMatch = Math.round(((outfitResult?.breakdown?.aesthetic || 0) + (outfitResult?.breakdown?.coverage || 0)) * 0.5);
      look.outfit.match_scored = !!outfitResult?.hasOutfit;
    }
  } catch (scoreErr) {
    console.error('[episodeCompletion] outfit match scoring failed; outfit_match is 0:', scoreErr?.message);
  }

  // ── 6. Run evaluation formula ──
  const currentStats = {
    coins: parseInt(characterState.coins) || 0,
    reputation: parseInt(characterState.reputation) || 0,
    brand_trust: parseInt(characterState.brand_trust) || 0,
    influence: parseInt(characterState.influence) || 0,
    stress: parseInt(characterState.stress) || 0,
  };

  const eventContext = event ? {
    prestige: event.prestige || 5,
    cost: parseFloat(event.cost_coins) || 0,
    strictness: event.strictness || 5,
    deadline: event.deadline_type,
  } : {};

  const evalResult = evaluate({
    state: currentStats,
    event: eventContext,
    style: { outfit_match: outfitMatch, accessory_match: accessoryMatch },
  });

  // ── 7. Compute base stat deltas from tier ──
  const baseDeltas = computeStatDeltas(evalResult, eventContext);

  // ── 8. Compute social task bonuses ──
  const socialBonuses = computeSocialTaskBonuses(socialTasks);

  // ── 9. Compute wardrobe intelligence bonuses ──
  const wardrobeBonuses = computeWardrobeBonuses(outfitPieces, event);

  // ── 10. Merge all stat deltas ──
  const mergedDeltas = { ...baseDeltas };

  // Add social task stat bonuses (NOT coins — those come from financial pipeline)
  if (socialBonuses.deltas) {
    for (const [key, val] of Object.entries(socialBonuses.deltas)) {
      if (key !== 'coins') mergedDeltas[key] = (mergedDeltas[key] || 0) + val;
    }
  }

  // Add wardrobe intelligence bonuses
  if (wardrobeBonuses.deltas) {
    for (const [key, val] of Object.entries(wardrobeBonuses.deltas)) {
      if (key !== 'coins') mergedDeltas[key] = (mergedDeltas[key] || 0) + val;
    }
  }

  // ── 10b. Apply event.rewards on success ───────────────────────────────
  // Creator-authored stat rewards from the event form (rewards.reputation,
  // .brand_trust, .influence). Only granted on slay/pass tiers — failing
  // the event shouldn't pay out the prize. They flow into mergedDeltas
  // alongside base/social/wardrobe. rewards.coins pays nothing: the event
  // reward retired with the tier reward (Evoni, 2026-09-29: "event_reward
  // retires with the tier reward (Law 8: money only from accepted terms;
  // legacy events keep payment_amount)"; deal build PR 5). Outcomes
  // (narrative beats) are recorded in the history note further down, not
  // as state changes.
  const eventRewards = (event && event.rewards && typeof event.rewards === 'object')
    ? (typeof event.rewards === 'string' ? (() => { try { return JSON.parse(event.rewards); } catch { return {}; } })() : event.rewards)
    : {};
  const isSuccess = ['slay', 'pass'].includes(evalResult.tier_final);
  if (isSuccess) {
    for (const key of ['reputation', 'brand_trust', 'influence']) {
      const v = parseInt(eventRewards[key], 10) || 0;
      if (v !== 0) mergedDeltas[key] = (mergedDeltas[key] || 0) + v;
    }
  }

  // Coins come only from the ledger rows booked below: Finalize's, and a
  // deal's payouts. The generic tier reward (+150/+75/+25/−25), the paid
  // bonus and the event reward are retired for every completion (Q12,
  // EVENT_EPISODE_FLOW.md §8(cc): "A SLAY does not automatically create
  // Prime Coins … The generic tier reward … is retired for all
  // completions"; "tier_paid_bonus retires too (Q12)"; deal build PR 5).

  // ── 10c–15. One transaction, idempotent (§8(x) D2, Task #2228) ──
  // Finalize, the reward rows, the coin change, the history row, the
  // episode's 'accepted' and the event's 'filmed' commit together or not at
  // all. The episode row is locked and 'accepted' re-checked under the lock,
  // so a retry or a concurrent call finds the episode already completed and
  // writes nothing; a failure rolls everything back, so a retry starts clean.
  let financialResult;
  let newState;
  let evaluationId;
  let narrativeLines;
  const outcome = await sequelize.transaction(async (transaction) => {
    const { finalizeEpisodeFinancials } = require('./financialTransactionService');
    const { withTransaction } = require('../utils/withTransaction');
    const db = withTransaction(sequelize, transaction);
    const [lockedEpisode] = await db.query(
      `SELECT evaluation_status, evaluation_json FROM episodes WHERE id = :episodeId FOR UPDATE`,
      { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
    );
    if (lockedEpisode?.evaluation_status === 'accepted') {
      return { already_completed: true, message: 'Episode already completed', evaluation: lockedEpisode.evaluation_json };
    }

    // ── 10c. The ledger balance before this completion books anything ──
    // D1 (§8(x), §8(y); Task #2247): the ledger is Lala's balance. Locking the
    // show here (after the episode, the order every ledger writer keeps) also
    // seeds an unseeded ledger. The refusal (Task #1933) is checked after the
    // rows are written, in step 12a, against the real balance; a refusal
    // rolls every row back.
    const { lockLedgerBalance, syncCoinsFromLedger } = require('./coinLedgerSync');
    const ledgerBefore = await lockLedgerBalance(sequelize, showId, { transaction });

    // ── 11. Finalize financials (coins come from here, not evaluation) ──
    financialResult = await finalizeEpisodeFinancials(episodeId, showId, sequelize, { transaction });

    // ── 11a. Deal payouts (deal build PR 5; DEAL_DESIGN.md §4, §10.3) ──
    // A deal event is paid its components at Complete accepted, each under
    // its own ledger name, and a deal_bonus only when its accepted terms
    // contain one for this tier. Once each (the payout unique index).
    const { bookCompletionPayouts } = require('./dealPayoutService');
    await bookCompletionPayouts(sequelize, {
      showId, episodeId, event, tier: evalResult.tier_final, transaction,
    });

    // Recompute coins from the ledger (D1): every row above, milestones and
    // the deal payouts included. The coin delta is the ledger's movement
    // across this completion; a finalize that already ran alone is in
    // ledgerBefore.
    const financialNet = (financialResult.summary?.total_income || 0) - (financialResult.summary?.total_expenses || 0);
    const { balance: ledgerAfter } = await syncCoinsFromLedger(sequelize, showId, { transaction });
    mergedDeltas.coins = ledgerAfter - ledgerBefore;

    // ── 12a. Refuse a completion that takes Lala below zero (Task #1933, §8(y) Q6) ──
    // Only a completion that spends is refused; one that earns is not, even
    // if a legacy balance is still below zero.
    if (ledgerAfter < 0 && mergedDeltas.coins < 0) {
      throw new InsufficientCoinsError({ needed: -mergedDeltas.coins, have: ledgerBefore, action: 'episode_completion' });
    }

    // ── 11b. Financial mood deltas ──
    // Translate the episode's financial outcome into stress deltas so Lala's
    // character state reflects "won a brand deal → relaxed" vs "blew 80% of
    // her savings on a gala → anxiety spikes". Additive into mergedDeltas so
    // outfit/event/social bonuses keep stacking alongside the money signal.
    try {
      const { getFinancialGoals } = require('./financialTransactionService');
      const balanceBefore = financialResult.balance_before || 0;
      const balanceAfter = financialResult.balance_after || 0;
      const milestonesHit = Array.isArray(financialResult.milestones_triggered) ? financialResult.milestones_triggered.length : 0;
      const goals = await getFinancialGoals(db, showId);
      const nextGoal = [...goals].sort((a, b) => a.threshold - b.threshold).find(g => !g.triggered_at);
      const nextThreshold = nextGoal?.threshold || null;
      // Stress scale is already roughly 0–10 in this codebase (see the 5/8
      // thresholds in the episode-complete memory write below). Keep our
      // deltas modest (±5 clamp) so a single episode can't spike or crater
      // Lala by itself — the trend matters more than one event.
      let stress = 0;
      if (nextThreshold && balanceAfter < nextThreshold * 0.25) stress += 2;
      else if (nextThreshold && balanceAfter < nextThreshold * 0.5) stress += 1;
      if (balanceAfter <= 0) stress += 2;                   // going broke hurts
      if (financialNet < -1000) stress += 2;                // big loss in one episode
      else if (financialNet < 0) stress += 1;
      if (financialNet > 500) stress -= 1;                  // winning
      if (financialNet > 2000) stress -= 2;                 // winning big
      stress -= 2 * milestonesHit;                          // each milestone = deep relief
      // Bank surplus (way above next goal) — she's on offense, not defense.
      if (nextThreshold && balanceAfter > nextThreshold * 1.5) stress -= 1;
      const clamped = Math.max(-5, Math.min(5, stress));
      if (clamped !== 0) {
        mergedDeltas.stress = (mergedDeltas.stress || 0) + clamped;
        mergedDeltas.financial_mood_delta = clamped;       // surfaced for debugging + UI
      }
      mergedDeltas._financial_context = {
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        episode_net: financialNet,
        milestones_hit: milestonesHit,
        next_goal_threshold: nextThreshold,
      };
    } catch (moodErr) {
      console.warn('[episodeComplete] financial mood delta failed:', moodErr.message);
    }

    // ── 12. Apply all deltas to character state ──
    newState = applyDeltas(currentStats, mergedDeltas);

    // Coins were written by syncCoinsFromLedger above; this statement writes
    // the other stats only (delta 0).
    newState.coins = ledgerAfter;
    await changeCoins(sequelize, {
      stateId: characterState.id,
      delta: 0,
      transaction,
      action: 'episode_completion',
      extraSet: `reputation = :reputation, brand_trust = :brand_trust,
           influence = :influence, stress = :stress,
           last_applied_episode_id = :episodeId`,
      extraReplacements: {
        reputation: newState.reputation, brand_trust: newState.brand_trust,
        influence: newState.influence, stress: newState.stress, episodeId,
      },
    });

    // ── 13. Write character_state_history with evaluation reference ──
    evaluationId = uuidv4();
    await db.query(
      `INSERT INTO character_state_history
       (id, show_id, character_key, episode_id, evaluation_id, source, deltas_json, state_after_json, notes, created_at)
       VALUES (:id, :showId, 'lala', :episodeId, :evaluationId, 'computed', :deltas, :stateAfter, :notes, NOW())`,
      { replacements: {
        id: uuidv4(), showId, episodeId, evaluationId,
        deltas: JSON.stringify(mergedDeltas),
        stateAfter: JSON.stringify(newState),
        notes: `${evalResult.tier_final.toUpperCase()} (${evalResult.score}/100) | Coins: ${mergedDeltas.coins >= 0 ? '+' : ''}${mergedDeltas.coins} | Social: ${socialBonuses.detail?.completed || 0}/${socialBonuses.detail?.total || 0} tasks | Outfit: ${outfitPieces.length} pieces${look.outfit.label ? ` (${look.outfit.label})` : ''}`,
      }}
    );

    // ── 14. Save evaluation to episode ──
    narrativeLines = generateNarrativeLine(evalResult);
    const fullEvaluation = {
      ...evalResult,
      stat_deltas: mergedDeltas,
      narrative_lines: narrativeLines,
      evaluation_id: evaluationId,
      social_task_bonuses: socialBonuses,
      wardrobe_bonuses: wardrobeBonuses,
      outfit: look.outfit,
      financial_summary: financialResult.summary,
      completed_at: new Date().toISOString(),
    };

    await db.query(
      `UPDATE episodes SET evaluation_json = :evalJson, evaluation_status = 'accepted',
       formula_version = :version, total_income = :income, total_expenses = :expenses,
       financial_score = :finScore, updated_at = NOW()
       WHERE id = :episodeId`,
      { replacements: {
        evalJson: JSON.stringify(fullEvaluation),
        version: FORMULA_VERSION,
        income: financialResult.summary?.total_income || 0,
        expenses: financialResult.summary?.total_expenses || 0,
        finScore: mergedDeltas.coins >= 0 ? 7 : mergedDeltas.coins >= -200 ? 5 : 3,
        episodeId,
      }}
    );

    // ── 15. Update event status to 'filmed' ──
    if (event) {
      await db.query(
        `UPDATE world_events SET status = 'filmed', updated_at = NOW() WHERE id = :id`,
        { replacements: { id: event.id } }
      );
    }

    return null;
  });
  if (outcome?.already_completed) return outcome;

  // ── 16. Auto-push episode outcome to franchise brain ──
  try {
    const episodeKnowledge = [
      {
        title: `Episode ${episode.episode_number || '?'}: ${episode.title || 'Untitled'} — ${evalResult.tier_final.toUpperCase()} Result`,
        content: `Episode "${episode.title}" completed with tier ${evalResult.tier_final.toUpperCase()} (score: ${evalResult.score}/100).
Event: ${event?.name || 'No event'}. Venue: ${event?.venue_name || 'Unknown'}.
Stat changes: ${Object.entries(mergedDeltas).filter(([,v]) => v !== 0).map(([k,v]) => `${k}: ${v >= 0 ? '+' : ''}${v}`).join(', ')}.
Final state: coins=${newState.coins}, reputation=${newState.reputation}, influence=${newState.influence}, brand_trust=${newState.brand_trust}, stress=${newState.stress}.
Social tasks: ${socialBonuses.detail?.completed || 0}/${socialBonuses.detail?.total || 0} completed. Outfit: ${outfitPieces.length} pieces${look.outfit.label ? ` (${look.outfit.label})` : ''}.
${narrativeLines.short || ''}`,
        category: 'narrative',
        severity: evalResult.tier_final === 'slay' ? 'important' : 'context',
        always_inject: false,
        applies_to: JSON.stringify(['episode_history', 'character_arc', evalResult.tier_final]),
        source_document: 'episode-completion',
        source_version: FORMULA_VERSION,
        extracted_by: 'system', // an allowed value (services/franchiseKnowledgeValues); source_document says episode-completion
        status: 'active',
        review_note: `Auto-generated on episode completion — ${new Date().toISOString()}`,
        injection_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    // Add character state snapshot as knowledge
    episodeKnowledge.push({
      title: `Character State after Episode ${episode.episode_number || '?'}`,
      content: `JustAWoman's stats after Episode ${episode.episode_number}: coins=${newState.coins}, reputation=${newState.reputation}, influence=${newState.influence}, brand_trust=${newState.brand_trust}, stress=${newState.stress}. ${newState.stress >= 8 ? 'STRESS IS CRITICAL — character is near breakdown.' : newState.stress >= 5 ? 'Stress is elevated — character is feeling pressure.' : 'Stress is manageable.'} ${newState.reputation >= 8 ? 'Reputation is strong — character is well-known.' : ''} ${newState.influence >= 8 ? 'Influence is high — character moves culture.' : ''}`,
      category: 'character',
      severity: 'important',
      always_inject: true,
      applies_to: JSON.stringify(['character_state', 'justawoman', 'current_stats']),
      source_document: 'episode-completion',
      source_version: FORMULA_VERSION,
      extracted_by: 'system', // an allowed value (services/franchiseKnowledgeValues); source_document says episode-completion
      status: 'active',
      review_note: `Auto-generated character state snapshot — Episode ${episode.episode_number}`,
      injection_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Supersede previous character state snapshot
    await sequelize.query(
      `UPDATE franchise_knowledge SET status = 'superseded', updated_at = NOW()
       WHERE source_document = 'episode-completion' AND category = 'character'
       AND applies_to::text LIKE '%current_stats%' AND status = 'active'`,
    ).catch(err => console.warn('[episodeCompletion] supersede previous state:', err?.message));

    // Insert new knowledge entries
    await sequelize.query(
      `INSERT INTO franchise_knowledge (title, content, category, severity, always_inject, applies_to, source_document, source_version, extracted_by, status, review_note, injection_count, created_at, updated_at)
       VALUES ${episodeKnowledge.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
      { replacements: episodeKnowledge.flatMap(e => [e.title, e.content, e.category, e.severity, e.always_inject, e.applies_to, e.source_document, e.source_version, e.extracted_by, e.status, e.review_note, e.injection_count, e.created_at, e.updated_at]) }
    ).catch(async () => {
      // Fallback: insert one at a time if bulk fails
      for (const entry of episodeKnowledge) {
        await sequelize.query(
          `INSERT INTO franchise_knowledge (title, content, category, severity, always_inject, applies_to, source_document, source_version, extracted_by, status, review_note, injection_count, created_at, updated_at)
           VALUES (:title, :content, :category, :severity, :always_inject, :applies_to, :source_document, :source_version, :extracted_by, :status, :review_note, :injection_count, :created_at, :updated_at)`,
          { replacements: entry }
        ).catch(err => console.warn('[episodeCompletion] fallback insert:', err?.message));
      }
    });

    console.log(`[Franchise Brain] Auto-pushed ${episodeKnowledge.length} entries for Episode ${episode.episode_number}`);
  } catch (brainErr) {
    console.warn('[Franchise Brain] Auto-push failed (non-blocking):', brainErr.message);
  }


  // ── 17. Career goals, measured (Season Arc §8(ff) Q11) ──
  // "replace '+1 to every goal' with each goal set from what it measures.
  // Coins come from the ledger, other stats from Lala's state after the
  // episode; custom goals are left unchanged." newState.coins is the ledger
  // balance (synced in step 11). Passive goals ("never drop below") and
  // metrics Lala's state does not carry are left unchanged too. Goals this
  // step completes spawn their unlocks_on_complete (Task #1817).
  const careerSummary = { goals_completed: [], goals_measured: [], unlocks: [], opportunities_advanced: [] };
  try {
    const goals = await sequelize.query(
      `SELECT id, title, type, priority, target_metric, current_value, target_value, unlocks_on_complete FROM career_goals
       WHERE show_id = :showId AND status = 'active' AND deleted_at IS NULL`,
      { replacements: { showId }, type: sequelize.QueryTypes.SELECT }
    ).catch((err) => {
      console.warn('[episodeComplete] career_goals load failed:', err?.message);
      return [];
    });
    for (const goal of goals || []) {
      if (goal.type === 'passive' || goal.target_metric === 'custom') continue;
      const measured = Number(newState?.[goal.target_metric]);
      if (!Number.isFinite(measured)) continue;
      const target = Number(goal.target_value);
      const newStatus = Number.isFinite(target) && measured >= target ? 'completed' : 'active';
      if (Number(goal.current_value) === measured && newStatus === 'active') continue;
      let goalWritten = true;
      await sequelize.query(
        `UPDATE career_goals SET current_value = :val, status = :status,
         completed_at = CASE WHEN :status = 'completed' THEN NOW() ELSE completed_at END,
         updated_at = NOW() WHERE id = :id`,
        { replacements: { val: measured, status: newStatus, id: goal.id } }
      ).catch(err => {
        goalWritten = false;
        console.warn('[episodeCompletion] career_goals update failed:', err?.message);
      });
      if (!goalWritten) continue;
      careerSummary.goals_measured.push({ id: goal.id, metric: goal.target_metric, value: measured, status: newStatus });

      // Only goals that transition to completed in this call spawn unlocks
      // (the SELECT above only returns status = 'active' goals).
      if (newStatus === 'completed') {
        careerSummary.goals_completed.push({ id: goal.id, title: goal.title });
        try {
          const { spawnGoalUnlocks } = require('./careerPipelineService');
          const spawned = await spawnGoalUnlocks(goal, showId, require('../models'));
          careerSummary.unlocks.push(...spawned);
        } catch (unlockErr) {
          console.error('[EpisodeCompletion] Goal unlock spawn failed (non-blocking):', goal.id, unlockErr?.message);
        }
      }
    }
  } catch (careerErr) {
    console.warn('[episodeComplete] Career goals failed (non-blocking):', careerErr.message);
  }

  // ── 17b. The season (Season Arc §8(ff) A6, Q6, Q7) ──
  // The episode's slot records its actual outcome and pressure, and the
  // season checks for a phase boundary (checkPhaseTransition); at a
  // boundary nothing advances, the roadmap asks first.
  let season = null;
  try {
    const { recordSlotOutcome } = require('./seasonSlotService');
    const moneyNet = (financialResult?.summary?.total_income || 0) - (financialResult?.summary?.total_expenses || 0);
    const stressDelta = (Number(newState?.stress) || 0) - (Number(currentStats?.stress) || 0);
    season = await recordSlotOutcome(sequelize, { showId, episodeId, tier: evalResult.tier_final, moneyNet, stressDelta });
    // The threads the slot continues are marked advanced (A6, Q9): the
    // primary purpose's and, since A10, each other purpose's.
    if (season) {
      const { advanceSlotThreads } = require('./storyThreadService');
      const advanced = await advanceSlotThreads(sequelize, { showId, episodeId });
      season.story_thread_advanced = advanced[0] || null;
      season.story_threads_advanced = advanced;
    }
  } catch (seasonErr) {
    console.error('[EpisodeCompletion] Season slot outcome failed (non-blocking):', seasonErr?.message);
  }

  // ── 17c. Ready the next slot (A6; Q12: "draft only the next open slot, on
  // acceptance and on demand") ──
  // An AI call: not awaited, so it never slows or blocks completion; a
  // failure is logged and the slot can be drafted on demand.
  if (season) {
    const { draftNextSlot } = require('./seasonIntentionService');
    draftNextSlot(sequelize, showId).catch((draftErr) => {
      console.error('[EpisodeCompletion] Next slot intention draft failed (non-blocking):', draftErr?.message);
    });
  }

  // ── 18. Complete the linked opportunity (Task #1817) ──
  // Runs once per completion: the already-accepted early return above skips
  // it on repeat calls. Opportunity only — no goal cascade (step 17 above is
  // the single goal advance).
  try {
    const { onEpisodeCompleted } = require('./careerPipelineService');
    const oppResult = await onEpisodeCompleted(episodeId, showId, require('../models'));
    careerSummary.opportunities_advanced.push(...(oppResult?.opportunities_advanced || []));
  } catch (oppErr) {
    console.error('[EpisodeCompletion] Opportunity completion failed (non-blocking):', oppErr?.message);
  }

  // ── 19. Event outcome for host + guests, post-event opportunities (Task #1818) ──
  // Generation records only the event history (recordEventHistory); what
  // depends on the score runs here, with the real tier: the host's
  // relevance boost (once per event, marker in the host's
  // full_profile.relevance_boosts), the tier-based state change for host and
  // guests, and the post-event opportunities (once per event, marker in
  // their status_history). Uses the event row loaded in step 2.
  const eventSync = { host_boosted: false, host_state: null, guest_states: [], opportunities_generated: [] };
  if (event) {
    const characterSync = require('./characterSyncService');
    try {
      const outcome = await characterSync.applyEventOutcome(event, evalResult.tier_final, require('../models'));
      eventSync.host_boosted = outcome.host_boosted;
      eventSync.host_state = outcome.host_state;
      eventSync.guest_states = outcome.guest_states;
    } catch (syncErr) {
      console.error('[EpisodeCompletion] Event outcome sync failed (non-blocking):', syncErr?.message);
    }
    try {
      const opps = await characterSync.generatePostEventOpportunities(event, evalResult.tier_final, require('../models'));
      eventSync.opportunities_generated = (opps || []).map(o => ({ id: o.id, name: o.name }));
    } catch (oppGenErr) {
      console.error('[EpisodeCompletion] Post-event opportunity generation failed (non-blocking):', oppGenErr?.message);
    }
  }

  return {
    episode_id: episodeId,
    evaluation: {
      score: evalResult.score,
      tier: evalResult.tier_final,
      breakdown: evalResult.breakdown,
      narrative: narrativeLines.short,
    },
    stat_deltas: mergedDeltas,
    previous_state: currentStats,
    new_state: newState,
    social_tasks: socialBonuses.detail,
    wardrobe: wardrobeBonuses.detail,
    outfit: look.outfit,
    financials: financialResult.summary,
    transactions: (financialResult.transactions || []).length,
    career: careerSummary,
    event_sync: eventSync,
    season,
  };
}

module.exports = {
  completeEpisode,
  loadEpisodeLook,
  computeSocialTaskBonuses,
  computeWardrobeBonuses,
};

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
  DEFAULT_STATS,
  FORMULA_VERSION,
} = require('../utils/evaluationFormula');

// ─── SOCIAL TASK STAT BONUSES ────────────────────────────────────────────────
// Completing social tasks should affect more than just coins

function computeSocialTaskBonuses(socialTasks) {
  if (!Array.isArray(socialTasks) || socialTasks.length === 0) return {};

  const completed = socialTasks.filter(t => t.completed);
  const total = socialTasks.length;
  const completionRate = total > 0 ? completed.length / total : 0;
  const requiredDone = socialTasks.filter(t => t.required && t.completed).length;
  const requiredTotal = socialTasks.filter(t => t.required).length;
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

// ─── MAIN: COMPLETE EPISODE ──────────────────────────────────────────────────

async function completeEpisode(episodeId, showId, sequelize) {
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

  // ── 2. Load event ──
  const [event] = await sequelize.query(
    `SELECT * FROM world_events WHERE used_in_episode_id = :episodeId LIMIT 1`,
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  ).catch(() => []);

  // Parse outfit pieces
  let outfitPieces = [];
  if (event?.outfit_pieces) {
    outfitPieces = typeof event.outfit_pieces === 'string' ? JSON.parse(event.outfit_pieces) : event.outfit_pieces;
  }

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
  let characterState;
  const [existingState] = await sequelize.query(
    `SELECT * FROM character_state WHERE show_id = :showId AND character_key = 'justawoman' LIMIT 1`,
    { replacements: { showId }, type: sequelize.QueryTypes.SELECT }
  ).catch(() => []);

  if (existingState) {
    characterState = existingState;
  } else {
    // Auto-seed
    const stateId = uuidv4();
    await sequelize.query(
      `INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
       VALUES (:id, :showId, 'justawoman', 500, 1, 1, 1, 0, NOW(), NOW())`,
      { replacements: { id: stateId, showId } }
    );
    characterState = { id: stateId, coins: 500, reputation: 1, brand_trust: 1, influence: 1, stress: 0 };
  }

  // ── 5. Get outfit score for evaluation ──
  let outfitMatch = 0, accessoryMatch = 0;
  try {
    const { getOutfitScore } = require('../routes/wardrobe');
    if (typeof getOutfitScore === 'function') {
      const models = require('../models');
      const eventContext = event ? {
        dress_code: event.dress_code, prestige: event.prestige,
        strictness: event.strictness, event_type: event.event_type,
      } : {};
      const outfitResult = await getOutfitScore(models, episodeId, eventContext);
      outfitMatch = Math.round((outfitResult?.score || 0) * 0.25);
      accessoryMatch = Math.round(((outfitResult?.aesthetic_synergy || 0) + (outfitResult?.coverage || 0)) * 0.5);
    }
  } catch { /* wardrobe scoring not available */ }

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

  // ── 11. Finalize financials (coins come from here, not evaluation) ──
  const { finalizeEpisodeFinancials } = require('./financialTransactionService');
  const financialResult = await finalizeEpisodeFinancials(episodeId, showId, sequelize);

  // Replace evaluation coin delta with financial pipeline result
  // Tier reward gets added as a transaction too
  const tierCoinRewards = { slay: 150, pass: 75, safe: 25, fail: -25 };
  const tierReward = tierCoinRewards[evalResult.tier_final] || 0;
  const paidBonus = (eventContext.cost > 0) ? (evalResult.tier_final === 'slay' ? 50 : evalResult.tier_final === 'pass' ? 25 : 0) : 0;

  // Log tier reward as a financial transaction
  if (tierReward !== 0) {
    try {
      await sequelize.query(
        `INSERT INTO financial_transactions
         (id, show_id, episode_id, event_id, type, category, amount, description, source_type, status, created_at, updated_at)
         VALUES (:id, :showId, :episodeId, :eventId, :type, 'tier_reward', :amount, :desc, 'evaluation', 'executed', NOW(), NOW())`,
        { replacements: {
          id: uuidv4(), showId, episodeId, eventId: event?.id || null,
          type: tierReward > 0 ? 'income' : 'expense',
          amount: Math.abs(tierReward),
          desc: `${evalResult.tier_final.toUpperCase()} tier reward: ${tierReward > 0 ? '+' : ''}${tierReward} coins`,
        }}
      );
    } catch { /* non-blocking */ }
  }

  if (paidBonus > 0) {
    try {
      await sequelize.query(
        `INSERT INTO financial_transactions
         (id, show_id, episode_id, event_id, type, category, amount, description, source_type, status, created_at, updated_at)
         VALUES (:id, :showId, :episodeId, :eventId, 'income', 'tier_paid_bonus', :amount, :desc, 'evaluation', 'executed', NOW(), NOW())`,
        { replacements: {
          id: uuidv4(), showId, episodeId, eventId: event?.id || null,
          amount: paidBonus,
          desc: `Paid event ${evalResult.tier_final.toUpperCase()} bonus: +${paidBonus} coins`,
        }}
      );
    } catch { /* non-blocking */ }
  }

  // Final coin delta = financial pipeline net + tier reward + paid bonus
  const financialNet = (financialResult.summary?.total_income || 0) - (financialResult.summary?.total_expenses || 0);
  mergedDeltas.coins = financialNet + tierReward + paidBonus;

  // ── 12. Apply all deltas to character state ──
  const newState = applyDeltas(currentStats, mergedDeltas);

  await sequelize.query(
    `UPDATE character_state
     SET coins = :coins, reputation = :reputation, brand_trust = :brand_trust,
         influence = :influence, stress = :stress,
         last_applied_episode_id = :episodeId, updated_at = NOW()
     WHERE id = :stateId`,
    { replacements: { ...newState, episodeId, stateId: characterState.id } }
  );

  // ── 13. Write character_state_history with evaluation reference ──
  const evaluationId = uuidv4();
  await sequelize.query(
    `INSERT INTO character_state_history
     (id, show_id, character_key, episode_id, evaluation_id, source, deltas_json, state_after_json, notes, created_at)
     VALUES (:id, :showId, 'justawoman', :episodeId, :evaluationId, 'computed', :deltas, :stateAfter, :notes, NOW())`,
    { replacements: {
      id: uuidv4(), showId, episodeId, evaluationId,
      deltas: JSON.stringify(mergedDeltas),
      stateAfter: JSON.stringify(newState),
      notes: `${evalResult.tier_final.toUpperCase()} (${evalResult.score}/100) | Coins: ${mergedDeltas.coins >= 0 ? '+' : ''}${mergedDeltas.coins} | Social: ${socialBonuses.detail?.completed || 0}/${socialBonuses.detail?.total || 0} tasks | Outfit: ${outfitPieces.length} pieces`,
    }}
  );

  // ── 14. Save evaluation to episode ──
  const narrativeLines = generateNarrativeLine(evalResult);
  const fullEvaluation = {
    ...evalResult,
    stat_deltas: mergedDeltas,
    narrative_lines: narrativeLines,
    evaluation_id: evaluationId,
    social_task_bonuses: socialBonuses,
    wardrobe_bonuses: wardrobeBonuses,
    financial_summary: financialResult.summary,
    completed_at: new Date().toISOString(),
  };

  await sequelize.query(
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
    try {
      await sequelize.query(
        `UPDATE world_events SET status = 'filmed', updated_at = NOW() WHERE id = :id`,
        { replacements: { id: event.id } }
      );
    } catch { /* non-blocking */ }
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
    financials: financialResult.summary,
    transactions: (financialResult.transactions || []).length,
  };
}

module.exports = {
  completeEpisode,
  computeSocialTaskBonuses,
  computeWardrobeBonuses,
};

'use strict';

const { DEFAULT_STARTING_BALANCE, DEFAULT_GOALS, EVENT_EXTRAS } = require('../utils/financialRates');

/**
 * Financial Transaction Service
 *
 * The execution layer for Lala's economy. Converts episode events into
 * actual coin movements:
 *
 *   Episode Finalized
 *     ├→ Deduct event entry cost
 *     ├→ Deduct wardrobe costs (owned items free, rentals cost rental_price)
 *     ├→ Credit event payment (if is_paid)
 *     ├→ Credit content revenue (brand_deal bonus)
 *     ├→ Credit social task rewards (per completed task)
 *     ├→ Update character state coins (running balance)
 *     └→ Log each as a transaction record
 */

const { v4: uuidv4 } = require('uuid');

// ─── SOCIAL TASK REWARD RATES ────────────────────────────────────────────────

const SOCIAL_TASK_REWARDS = {
  // Required tasks pay more
  required: { base: 25, viral_bonus: 50 },
  optional: { base: 10, viral_bonus: 25 },
};

const TIMING_MULTIPLIERS = {
  before: 1.0,   // Standard rate — prep work
  during: 1.2,   // Premium — capturing live moments
  after:  0.8,   // Lower — post-event content is easier
};

// ─── GET CURRENT BALANCE ─────────────────────────────────────────────────────

/**
 * Read the starting balance from the Show's metadata JSON. Falls back to the
 * module-level default when the show doesn't override. Used when:
 *  - no transactions exist yet (new show),
 *  - the transactions table is unavailable (legacy envs),
 *  - seeding the first transaction.
 */
async function getStartingBalance(sequelize, showId) {
  try {
    const [row] = await sequelize.query(
      `SELECT metadata FROM shows WHERE id = :showId LIMIT 1`,
      { replacements: { showId }, type: sequelize.QueryTypes.SELECT }
    );
    const meta = typeof row?.metadata === 'string' ? JSON.parse(row.metadata) : row?.metadata;
    const v = Number(meta?.starting_balance);
    if (Number.isFinite(v) && v >= 0) return v;
  } catch { /* fall through to default */ }
  return DEFAULT_STARTING_BALANCE;
}

async function getCurrentBalance(sequelize, showId) {
  try {
    // Sum all executed transactions to get current balance
    const [row] = await sequelize.query(
      `SELECT
        COUNT(*)::int as tx_count,
        COALESCE(
          SUM(CASE WHEN type = 'income' OR type = 'reward' THEN amount ELSE 0 END) -
          SUM(CASE WHEN type = 'expense' OR type = 'deduction' THEN amount ELSE 0 END),
          0
        ) as balance
      FROM financial_transactions
      WHERE show_id = :showId AND status = 'executed' AND deleted_at IS NULL`,
      { replacements: { showId }, type: sequelize.QueryTypes.SELECT }
    );
    const balance = parseFloat(row?.balance) || 0;
    // When the ledger is empty, Lala hasn't earned or spent anything yet —
    // show the starting balance instead of 0 so the UI reflects her seed.
    // Callers that care about "is there a real history" can use the ledger
    // directly; most just want the displayable number.
    if ((row?.tx_count || 0) === 0) {
      return await getStartingBalance(sequelize, showId);
    }
    return balance;
  } catch {
    // Table might not exist yet — try character_state_history fallback
    try {
      const [state] = await sequelize.query(
        `SELECT state_after_json FROM character_state_history
         WHERE show_id = :showId AND deleted_at IS NULL
         ORDER BY created_at DESC LIMIT 1`,
        { replacements: { showId }, type: sequelize.QueryTypes.SELECT }
      );
      if (state) {
        const json = typeof state.state_after_json === 'string' ? JSON.parse(state.state_after_json) : state.state_after_json;
        return parseFloat(json?.coins) || 0;
      }
    } catch { /* fall through */ }
    return getStartingBalance(sequelize, showId);
  }
}

/**
 * Seed the starting balance as a real transaction row. Idempotent: if a
 * 'seed' transaction already exists for this show, returns it without making
 * a duplicate. Call this from show-creation or the first-time someone opens
 * the wardrobe so the ledger has a clean origin row instead of treating the
 * starting balance as an invisible baseline.
 */
async function seedStartingBalance(sequelize, showId) {
  try {
    const [existing] = await sequelize.query(
      `SELECT id, amount FROM financial_transactions
       WHERE show_id = :showId AND category = 'seed' AND status = 'executed' AND deleted_at IS NULL
       LIMIT 1`,
      { replacements: { showId }, type: sequelize.QueryTypes.SELECT }
    );
    if (existing) return { seeded: false, existing };

    const amount = await getStartingBalance(sequelize, showId);
    if (!amount || amount <= 0) return { seeded: false, reason: 'starting_balance is 0' };

    const tx = await logTransaction(sequelize, showId, {
      type: 'income',
      category: 'seed',
      amount,
      description: 'Starting balance',
      source_type: 'show_init',
      source_name: 'Initial grant',
      balance_before: 0,
      balance_after: amount,
      status: 'executed',
    });
    return { seeded: true, transaction: tx };
  } catch (err) {
    console.warn('[FinancialTx] seedStartingBalance failed:', err.message);
    return { seeded: false, error: err.message };
  }
}

/**
 * Read the show's financial goals (with any `triggered_at` timestamps carried
 * forward from previous crossings). Falls back to DEFAULT_GOALS when the show
 * hasn't configured its own ladder. `triggered_at` is stored on each goal so
 * the milestone check can tell "already fired" from "not yet reached" without
 * scanning the transaction ledger.
 */
async function getFinancialGoals(sequelize, showId) {
  try {
    const [row] = await sequelize.query(
      `SELECT metadata FROM shows WHERE id = :showId LIMIT 1`,
      { replacements: { showId }, type: sequelize.QueryTypes.SELECT }
    );
    const meta = typeof row?.metadata === 'string' ? JSON.parse(row.metadata) : row?.metadata;
    const configured = Array.isArray(meta?.financial_goals) ? meta.financial_goals : null;
    return configured && configured.length ? configured : DEFAULT_GOALS.map(g => ({ ...g, triggered_at: null }));
  } catch {
    return DEFAULT_GOALS.map(g => ({ ...g, triggered_at: null }));
  }
}

/**
 * Persist `triggered_at` for a specific goal back to shows.metadata so it
 * doesn't re-fire on the next transaction. Non-destructive: preserves all
 * other metadata keys. Best-effort — logs and moves on if the update fails.
 */
async function markGoalTriggered(sequelize, showId, goalId, triggeredAt) {
  try {
    const [row] = await sequelize.query(
      `SELECT metadata FROM shows WHERE id = :showId LIMIT 1`,
      { replacements: { showId }, type: sequelize.QueryTypes.SELECT }
    );
    const meta = typeof row?.metadata === 'string' ? JSON.parse(row.metadata) : (row?.metadata || {});
    const goals = Array.isArray(meta.financial_goals) && meta.financial_goals.length
      ? meta.financial_goals
      : DEFAULT_GOALS.map(g => ({ ...g, triggered_at: null }));
    const next = goals.map(g => g.id === goalId ? { ...g, triggered_at: triggeredAt } : g);
    const nextMeta = { ...meta, financial_goals: next };
    await sequelize.query(
      `UPDATE shows SET metadata = :meta, updated_at = NOW() WHERE id = :showId`,
      { replacements: { showId, meta: JSON.stringify(nextMeta) } }
    );
  } catch (err) {
    console.warn('[FinancialTx] markGoalTriggered failed:', err.message);
  }
}

/**
 * Milestone engine — after a balance change, fire rewards for any goal
 * whose threshold Lala just crossed upward. One-shot: triggered_at guards
 * against re-firing when balance dips and returns above the threshold.
 *
 * Goals can optionally scope to a specific episode via `goal.episode_id`.
 * When set, the goal only fires if the current transaction is tied to
 * that episode; unscoped goals (episode_id null) fire globally. Lets
 * creators build per-episode money targets ("reach 10k by end of ep 3")
 * alongside show-wide ladder milestones.
 *
 * Returns `{ triggered: [{ goal, payout_tx }] }` so callers (logTransaction,
 * episodeCompletion) can surface the milestone to UI / Feed.
 */
async function checkMilestones(sequelize, showId, oldBalance, newBalance, opts = {}) {
  // Only check on upward crossings — dropping below a threshold is its own
  // narrative (financial pressure) but doesn't un-trigger a milestone.
  if (newBalance <= oldBalance) return { triggered: [] };

  const { episodeId = null } = opts;
  const goals = await getFinancialGoals(sequelize, showId);
  const crossed = goals.filter(g => {
    if (g.triggered_at) return false;
    if (g.threshold <= oldBalance || g.threshold > newBalance) return false;
    // Episode-scoped goals only fire when we're finalizing that exact
    // episode. Unscoped goals (episode_id null/undefined) fire anywhere.
    if (g.episode_id && g.episode_id !== episodeId) return false;
    return true;
  });
  if (!crossed.length) return { triggered: [] };

  const triggered = [];
  for (const goal of crossed) {
    const reward = Number(goal.reward_coins) || 0;
    const tx = await logTransaction(sequelize, showId, {
      type: 'reward',
      category: 'milestone',
      amount: reward,
      description: `Milestone: ${goal.label} — ${goal.description || ''}`.trim(),
      source_type: 'milestone',
      source_id: goal.id,
      source_name: goal.label,
      metadata: { goal_id: goal.id, threshold: goal.threshold },
      status: 'executed',
    });
    await markGoalTriggered(sequelize, showId, goal.id, new Date().toISOString());
    triggered.push({ goal, payout_tx: tx });
  }
  return { triggered };
}

// ─── LOG A SINGLE TRANSACTION ────────────────────────────────────────────────

async function logTransaction(sequelize, showId, tx) {
  const id = uuidv4();
  // When a Sequelize transaction is passed in, we both run the INSERT inside
  // it AND rethrow on failure so the caller's transaction can roll back.
  // Without this, the outer transaction would commit a half-baked state
  // (e.g. character_state.coins decremented but no ledger row).
  const t = tx.transaction || null;
  try {
    await sequelize.query(
      `INSERT INTO financial_transactions
       (id, show_id, episode_id, event_id, type, category, amount, description,
        source_type, source_id, source_name, balance_before, balance_after,
        metadata, status, created_at, updated_at)
       VALUES (:id, :showId, :episodeId, :eventId, :type, :category, :amount, :description,
        :sourceType, :sourceId, :sourceName, :balanceBefore, :balanceAfter,
        :metadata, :status, NOW(), NOW())`,
      {
        replacements: {
          id,
          showId,
          episodeId: tx.episode_id || null,
          eventId: tx.event_id || null,
          type: tx.type,
          category: tx.category,
          amount: tx.amount,
          description: tx.description || null,
          sourceType: tx.source_type || null,
          sourceId: tx.source_id || null,
          sourceName: tx.source_name || null,
          balanceBefore: tx.balance_before ?? null,
          balanceAfter: tx.balance_after ?? null,
          metadata: JSON.stringify(tx.metadata || {}),
          status: tx.status || 'executed',
        },
        ...(t ? { transaction: t } : {}),
      }
    );
    return { id, ...tx };
  } catch (err) {
    console.warn('[FinancialTx] Log failed:', err.message);
    if (t) throw err;  // propagate so the outer transaction rolls back
    return null;
  }
}

// ─── CALCULATE SOCIAL TASK REWARDS ───────────────────────────────────────────

function calculateSocialTaskRewards(socialTasks) {
  if (!Array.isArray(socialTasks) || socialTasks.length === 0) return [];

  return socialTasks
    .filter(t => t.completed)
    .map(t => {
      const rates = t.required ? SOCIAL_TASK_REWARDS.required : SOCIAL_TASK_REWARDS.optional;
      const timingMult = TIMING_MULTIPLIERS[t.timing] || 1.0;
      const reward = Math.round(rates.base * timingMult);

      return {
        slot: t.slot,
        label: t.label,
        platform: t.platform,
        timing: t.timing,
        required: t.required,
        reward,
        description: `Content: "${t.label}" on ${t.platform || 'social'}`,
      };
    });
}

function normalizePaidFreeFlags(event) {
  const truthy = new Set([true, 1, '1', 'true', 'yes', 'y']);
  const isPaid = truthy.has(event?.is_paid);
  const isFree = truthy.has(event?.is_free);
  const eventCost = isFree ? 0 : (isPaid ? 0 : (Number(event?.cost_coins) || 0));
  const eventPayment = isPaid ? (parseFloat(event?.payment_amount) || 0) : 0;
  return { isPaid, isFree, eventCost, eventPayment };
}

// ─── FINALIZE EPISODE FINANCIALS ─────────────────────────────────────────────

/**
 * Execute all financial transactions for an episode.
 * Called when an episode is finalized/filmed.
 *
 * @param {string} episodeId
 * @param {string} showId
 * @param {object} sequelize
 * @returns {object} { transactions, summary, balance_before, balance_after }
 */
async function finalizeEpisodeFinancials(episodeId, showId, sequelize) {
  // 1. Check if already finalized
  const [existingTx] = await sequelize.query(
    `SELECT COUNT(*) as cnt FROM financial_transactions
     WHERE episode_id = :episodeId AND status = 'executed' AND deleted_at IS NULL`,
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  ).catch(() => [{ cnt: 0 }]);

  if (parseInt(existingTx?.cnt) > 0) {
    // Already finalized — return existing summary
    const [rows] = await sequelize.query(
      `SELECT type, category, amount, description, source_name, created_at
       FROM financial_transactions
       WHERE episode_id = :episodeId AND status = 'executed' AND deleted_at IS NULL
       ORDER BY created_at`,
      { replacements: { episodeId } }
    );
    const balance = await getCurrentBalance(sequelize, showId);
    return {
      already_finalized: true,
      transactions: rows || [],
      balance: balance,
    };
  }

  // 2. Load event linked to episode
  const [event] = await sequelize.query(
    `SELECT * FROM world_events WHERE used_in_episode_id = :episodeId LIMIT 1`,
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  ).catch(() => []);

  // 3. Load outfit pieces (if saved on event)
  let outfitPieces = [];
  if (event?.outfit_pieces) {
    outfitPieces = typeof event.outfit_pieces === 'string'
      ? JSON.parse(event.outfit_pieces) : event.outfit_pieces;
  }

  // 4. Load social tasks from episode_todo_lists
  let socialTasks = [];
  try {
    const [todoList] = await sequelize.query(
      `SELECT social_tasks FROM episode_todo_lists WHERE episode_id = :episodeId AND deleted_at IS NULL LIMIT 1`,
      { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
    );
    if (todoList?.social_tasks) {
      socialTasks = typeof todoList.social_tasks === 'string'
        ? JSON.parse(todoList.social_tasks) : todoList.social_tasks;
    }
  } catch { /* non-blocking */ }

  // Also check event automation for social tasks
  if (socialTasks.length === 0 && event) {
    let cc = event.canon_consequences;
    if (typeof cc === 'string') try { cc = JSON.parse(cc); } catch { cc = {}; }
    const auto = cc?.automation || {};
    if (auto.social_tasks?.length > 0) socialTasks = auto.social_tasks;
  }

  // 5. Get current balance
  let balance = await getCurrentBalance(sequelize, showId);
  const balanceBefore = balance;
  const transactions = [];

  const addTx = async (tx) => {
    tx.balance_before = balance;
    if (tx.type === 'income' || tx.type === 'reward') {
      balance += parseFloat(tx.amount);
    } else {
      balance -= parseFloat(tx.amount);
    }
    balance = Math.max(0, Math.round(balance * 100) / 100);
    tx.balance_after = balance;
    tx.episode_id = episodeId;
    tx.event_id = event?.id || null;
    const logged = await logTransaction(sequelize, showId, tx);
    if (logged) transactions.push(logged);
  };

  if (event) {
    const { isPaid, eventCost, eventPayment } = normalizePaidFreeFlags(event);

    // 6. Event entry cost (expense)
    if (eventCost > 0) {
      await addTx({
        type: 'expense', category: 'event_entry', amount: eventCost,
        description: `Entry cost for "${event.name}"`,
        source_type: 'event', source_id: event.id, source_name: event.name,
      });
    }

    // 7. Wardrobe costs (expense — skip gifted/borrowed/owned)
    for (const piece of outfitPieces) {
      const acq = piece.acquisition_type || 'purchased';
      if (acq === 'gifted' || acq === 'borrowed') continue;

      if (acq === 'rented' && piece.rental_price > 0) {
        await addTx({
          type: 'expense', category: 'wardrobe_rental', amount: parseFloat(piece.rental_price),
          description: `Rental: ${piece.name}`,
          source_type: 'wardrobe', source_id: piece.id, source_name: piece.name,
          metadata: { tier: piece.tier, brand: piece.brand },
        });
      } else if (!piece.is_owned) {
        const cost = parseFloat(piece.coin_cost) || parseFloat(piece.price) || 0;
        if (cost > 0) {
          await addTx({
            type: 'expense', category: 'wardrobe_purchase', amount: cost,
            description: `Purchase: ${piece.name}`,
            source_type: 'wardrobe', source_id: piece.id, source_name: piece.name,
            metadata: { tier: piece.tier, brand: piece.brand },
          });
        }
      }
    }

    // 8. Styling extras (same extra model as financial preview)
    const prestige = event.prestige || 5;
    const drinks = EVENT_EXTRAS.drinks(prestige);
    const valet = EVENT_EXTRAS.valet(prestige);
    const photoBoothPrompt = (event.dress_code || '').toLowerCase();
    const wantsPhotoBooth = ['gala', 'premiere', 'launch', 'brand_deal'].includes(event.event_type)
      || photoBoothPrompt.includes('red carpet') || photoBoothPrompt.includes('photo');
    const photoBooth = wantsPhotoBooth ? EVENT_EXTRAS.photo_booth(prestige) : 0;
    const extras = drinks + valet + photoBooth;
    if (extras > 0) {
      await addTx({
        type: 'expense', category: 'styling_extras', amount: extras,
        description: `Styling, transport & extras (drinks ${drinks}, valet ${valet}${photoBooth > 0 ? `, photo ${photoBooth}` : ''})`,
        source_type: 'event', source_id: event.id, source_name: event.name,
      });
    }

    // 9. Event payment (income — if is_paid)
    if (isPaid && eventPayment > 0) {
      await addTx({
        type: 'income', category: 'event_payment', amount: eventPayment,
        description: `Payment for "${event.name}"`,
        source_type: 'event', source_id: event.id, source_name: event.name,
      });
    }

    // 10. Brand deal content revenue bonus
    if (event.event_type === 'brand_deal' && eventPayment > 0) {
      const contentBonus = Math.round(eventPayment * 0.1);
      if (contentBonus > 0) {
        await addTx({
          type: 'income', category: 'content_revenue', amount: contentBonus,
          description: `Content delivery bonus for ${event.host_brand || event.name}`,
          source_type: 'event', source_id: event.id, source_name: event.name,
        });
      }
    }
  }

  // 11. Social task rewards
  const taskRewards = calculateSocialTaskRewards(socialTasks);
  for (const reward of taskRewards) {
    await addTx({
      type: 'reward', category: 'social_task_reward', amount: reward.reward,
      description: reward.description,
      source_type: 'social_task', source_name: reward.label,
      metadata: { platform: reward.platform, timing: reward.timing, required: reward.required },
    });
  }

  // 12. Update episode financial totals
  const totalIncome = transactions.filter(t => t.type === 'income' || t.type === 'reward').reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense' || t.type === 'deduction').reduce((s, t) => s + parseFloat(t.amount), 0);
  const netProfit = totalIncome - totalExpenses;

  try {
    await sequelize.query(
      `UPDATE episodes SET total_income = :income, total_expenses = :expenses,
       financial_score = :score, updated_at = NOW()
       WHERE id = :episodeId`,
      { replacements: {
        income: totalIncome, expenses: totalExpenses,
        score: netProfit >= 0 ? 7 : netProfit >= -200 ? 5 : 3,
        episodeId,
      }}
    );
  } catch { /* non-blocking */ }

  // 13. Update character_state_history with new coin balance
  try {
    await sequelize.query(
      `INSERT INTO character_state_history
       (id, show_id, character_key, episode_id, source, deltas_json, state_after_json, notes, created_at)
       VALUES (:id, :showId, 'justawoman', :episodeId, 'computed',
        :deltas, :stateAfter, :notes, NOW())`,
      { replacements: {
        id: uuidv4(),
        showId,
        episodeId,
        deltas: JSON.stringify({ coins: netProfit }),
        stateAfter: JSON.stringify({ coins: balance }),
        notes: `Financial finalization: +${totalIncome} income, -${totalExpenses} expenses = ${netProfit >= 0 ? '+' : ''}${netProfit} net`,
      }}
    );
  } catch (err) { console.warn('[FinancialTx] CSH update failed:', err.message); }

  return {
    transactions,
    summary: {
      total_income: totalIncome,
      total_expenses: totalExpenses,
      net_profit: netProfit,
      social_task_rewards: taskRewards.reduce((s, r) => s + r.reward, 0),
      wardrobe_cost: transactions.filter(t => t.category === 'wardrobe_purchase' || t.category === 'wardrobe_rental').reduce((s, t) => s + parseFloat(t.amount), 0),
      event_cost: normalizePaidFreeFlags(event).eventCost,
      event_payment: normalizePaidFreeFlags(event).eventPayment,
    },
    balance_before: balanceBefore,
    balance_after: balance,
    // Milestones crossed in this episode. Checked on the full episode net
    // (before → after) so a single episode can fire multiple milestones if
    // Lala jumps from "rising-star" straight past "it-girl". Each entry has
    // { goal, payout_tx } and the payout is already in the ledger.
    milestones_triggered: await (async () => {
      const result = await checkMilestones(sequelize, showId, balanceBefore, balance, { episodeId });
      // Feed integration — one post per milestone reached, plus an
      // aggregate big-spend post when the episode moved a lot of coins.
      // Wrapped in try/catch so a feed-table issue can't 500 the
      // finalize endpoint.
      try {
        const feed = require('./financialFeedService');
        if (result.triggered.length > 0) {
          await feed.postMilestoneReached(sequelize, showId, result.triggered, { episodeId });
        }
        const goals = await getFinancialGoals(sequelize, showId);
        const nextGoal = [...goals].sort((a, b) => a.threshold - b.threshold).find(g => !g.triggered_at);
        await feed.postBigSpend(sequelize, showId, {
          wardrobe_cost: parseFloat(event?.outfit_score?.outfit_cost) || 0,
          event_cost: parseFloat(event?.cost_coins) || 0,
        }, balance, {
          episodeId,
          eventId: event?.id,
          nextGoalThreshold: nextGoal?.threshold,
        });
      } catch (feedErr) {
        console.warn('[finalizeEpisodeFinancials] feed post failed:', feedErr.message);
      }
      return result.triggered;
    })(),
  };
}

// ─── GET FINANCIAL LEDGER ────────────────────────────────────────────────────

/**
 * Get the running financial ledger for a show — all transactions across episodes.
 */
async function getFinancialLedger(showId, sequelize, options = {}) {
  const limit = options.limit || 100;
  const episodeId = options.episodeId || null;

  const whereClause = episodeId
    ? 'WHERE ft.show_id = :showId AND ft.episode_id = :episodeId AND ft.deleted_at IS NULL'
    : 'WHERE ft.show_id = :showId AND ft.deleted_at IS NULL';
  const replacements = episodeId ? { showId, episodeId, limit } : { showId, limit };

  const [rows] = await sequelize.query(
    `SELECT ft.*, e.title as episode_title, e.episode_number
     FROM financial_transactions ft
     LEFT JOIN episodes e ON e.id = ft.episode_id
     ${whereClause}
     ORDER BY ft.created_at DESC
     LIMIT :limit`,
    { replacements }
  );

  const balance = await getCurrentBalance(sequelize, showId);

  // Episode-level summary
  const [episodeSummary] = await sequelize.query(
    `SELECT e.id, e.episode_number, e.title,
       COALESCE(e.total_income, 0) as total_income,
       COALESCE(e.total_expenses, 0) as total_expenses,
       e.financial_score
     FROM episodes e
     WHERE e.show_id = :showId AND e.deleted_at IS NULL
     ORDER BY e.episode_number`,
    { replacements: { showId } }
  ).catch(() => [[]]);

  return {
    transactions: rows || [],
    balance,
    episode_summary: episodeSummary || [],
    count: (rows || []).length,
  };
}

module.exports = {
  getCurrentBalance,
  getStartingBalance,
  seedStartingBalance,
  getFinancialGoals,
  markGoalTriggered,
  checkMilestones,
  logTransaction,
  calculateSocialTaskRewards,
  finalizeEpisodeFinancials,
  getFinancialLedger,
};

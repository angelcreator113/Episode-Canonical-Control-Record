'use strict';

/**
 * Financial Pressure Service
 *
 * Manages Lala's economic reality:
 * - Running balance from the character state (coins)
 * - Transaction ledger (income/expenses per event/opportunity)
 * - Affordability checks (can she attend this event?)
 * - Financial pressure context for script writing
 * - Declined invite tracking for future episode callbacks
 */

// ─── AFFORDABILITY CHECK ────────────────────────────────────────────────────

/**
 * Check if Lala can afford an event, and what it would cost.
 *
 * @param {object} event - WorldEvent
 * @param {number} currentBalance - Lala's current coin balance
 * @returns {object} { affordable, totalCost, breakdown, pressure_level, narrative }
 */
function checkAffordability(event, currentBalance) {
  const prestige = event.prestige || 5;
  const entryCost = parseFloat(event.cost_coins) || 0;

  // Estimate outfit cost based on prestige tier
  const outfitCost = prestige >= 8 ? 400 : prestige >= 6 ? 250 : prestige >= 4 ? 120 : 50;

  // Transport/styling extras
  const extras = prestige >= 7 ? 100 : prestige >= 4 ? 50 : 20;

  const totalCost = entryCost + outfitCost + extras;
  const remainingAfter = currentBalance - totalCost;
  const affordable = remainingAfter >= 0;

  // Pressure level
  let pressureLevel, narrative;
  if (!affordable) {
    pressureLevel = 'broke';
    narrative = `Lala can't afford this. She needs ${totalCost - currentBalance} more coins. She could take a brand deal, skip the outfit upgrade, or ask someone to cover her.`;
  } else if (remainingAfter < 100) {
    pressureLevel = 'tight';
    narrative = `She can barely afford this. After the event she'll have almost nothing left. One more event could break her.`;
  } else if (remainingAfter < totalCost) {
    pressureLevel = 'stretched';
    narrative = `She can attend but it'll hurt. She won't be able to afford another event like this for a while.`;
  } else if (remainingAfter < currentBalance * 0.5) {
    pressureLevel = 'cautious';
    narrative = `She can afford it, but it's a real investment. She needs to make sure this one counts.`;
  } else {
    pressureLevel = 'comfortable';
    narrative = `Money isn't the issue here. The question is whether it's worth her time.`;
  }

  return {
    affordable,
    totalCost,
    remainingAfter,
    breakdown: {
      entry: entryCost,
      outfit_estimate: outfitCost,
      extras,
    },
    pressure_level: pressureLevel,
    narrative,
    currentBalance,
  };
}

// ─── DECLINED INVITE TRACKER ────────────────────────────────────────────────

/**
 * Record a declined invite for future script callbacks.
 *
 * @param {object} event - The declined event
 * @param {string} reason - Why Lala declined
 * @param {object} models - Sequelize models
 */
async function recordDeclinedInvite(event, reason, models) {
  const auto = event.canon_consequences?.automation || {};

  const declinedRecord = {
    event_id: event.id,
    event_name: event.name,
    host: auto.host_display_name || event.host,
    host_handle: auto.host_handle,
    venue: auto.venue_name || event.venue_name,
    prestige: event.prestige,
    reason: reason,
    declined_at: new Date().toISOString(),
    // For script callbacks
    callback_hooks: [
      `Lala sees photos from ${event.name} on her feed`,
      `${auto.host_display_name || 'The host'} mentions the event was amazing`,
      `Someone who attended brings it up — "You missed it"`,
      `A brand that was at the event reaches out to someone else instead`,
    ],
    referenced_in_episodes: [], // Will be populated when callbacks are used
  };

  // Store on the event
  try {
    const cc = typeof event.canon_consequences === 'string'
      ? JSON.parse(event.canon_consequences)
      : (event.canon_consequences || {});
    cc.declined = declinedRecord;

    await models.sequelize.query(
      'UPDATE world_events SET status = :status, canon_consequences = :cc, updated_at = NOW() WHERE id = :id',
      { replacements: { status: 'declined', cc: JSON.stringify(cc), id: event.id } }
    );
  } catch (err) {
    console.warn('[FinancialPressure] Failed to record declined invite:', err.message);
  }

  return declinedRecord;
}

// ─── FINANCIAL PRESSURE CONTEXT FOR SCRIPTS ─────────────────────────────────

/**
 * Generate financial pressure context for episode script writing.
 * This gets injected into the AI prompt when writing scripts.
 *
 * @param {number} balance - Current coin balance
 * @param {object[]} recentTransactions - Recent income/expenses
 * @param {object[]} declinedInvites - Events Lala couldn't afford
 * @param {object[]} pendingOpportunities - Opportunities in pipeline
 */
function buildFinancialPressureContext(balance, recentTransactions = [], declinedInvites = [], pendingOpportunities = []) {
  const totalIncome = recentTransactions
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const totalExpenses = recentTransactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

  const pendingIncome = pendingOpportunities
    .filter(o => ['booked', 'active', 'completed'].includes(o.status))
    .reduce((s, o) => s + (parseFloat(o.payment_amount) || 0), 0);

  let pressureNarrative;
  if (balance <= 0) {
    pressureNarrative = 'Lala is broke. Every decision is about survival. She needs money before she can do anything. This colors every interaction with desperation she tries to hide.';
  } else if (balance < 200) {
    pressureNarrative = 'Lala is running low. She checks prices before ordering. She says "maybe next time" to invitations she wants to accept. The pressure is constant but invisible to her followers.';
  } else if (balance < 500) {
    pressureNarrative = 'Lala is okay but cautious. She can attend events but has to choose carefully. Every outfit purchase is a calculation. She knows one bad month could change everything.';
  } else if (balance < 1500) {
    pressureNarrative = 'Lala is comfortable but not wealthy. She can attend most events but still thinks about cost. High-prestige events require planning. She\'s building, not flexing.';
  } else {
    pressureNarrative = 'Lala is financially secure for now. Money isn\'t driving her decisions — ambition, status, and relationships are. But she remembers being broke and never takes it for granted.';
  }

  const declinedContext = declinedInvites.length > 0
    ? `She has declined ${declinedInvites.length} invite(s) recently: ${declinedInvites.slice(0, 3).map(d => `"${d.event_name}" (${d.reason})`).join(', ')}. These haunt her feed.`
    : '';

  const pipelineContext = pendingIncome > 0
    ? `She has ${pendingOpportunities.length} opportunity/ies in the pipeline worth ~${pendingIncome} coins. Money is coming but not here yet.`
    : '';

  return {
    balance,
    pressure_narrative: pressureNarrative,
    declined_context: declinedContext,
    pipeline_context: pipelineContext,
    recent_income: totalIncome,
    recent_expenses: totalExpenses,
    net_trend: totalIncome - totalExpenses > 0 ? 'growing' : totalIncome - totalExpenses < 0 ? 'shrinking' : 'flat',
    // Full prompt injection
    script_context: [pressureNarrative, declinedContext, pipelineContext].filter(Boolean).join('\n'),
  };
}

// ─── TRANSACTION LOGGER ─────────────────────────────────────────────────────

/**
 * Log a financial transaction and update Lala's balance.
 */
async function logTransaction(models, showId, { type, amount, source, source_id, description }) {
  // Update character state coins
  try {
    const delta = type === 'income' ? amount : -amount;

    // Get current state
    const [state] = await models.sequelize.query(
      `SELECT id, state_json FROM character_state_history
       WHERE show_id = :showId ORDER BY created_at DESC LIMIT 1`,
      { replacements: { showId }, type: models.sequelize.QueryTypes.SELECT }
    );

    if (state) {
      const stateJson = typeof state.state_json === 'string' ? JSON.parse(state.state_json) : (state.state_json || {});
      const currentCoins = stateJson.coins || 0;
      stateJson.coins = Math.max(0, currentCoins + delta);

      await models.sequelize.query(
        'UPDATE character_state_history SET state_json = :state, updated_at = NOW() WHERE id = :id',
        { replacements: { state: JSON.stringify(stateJson), id: state.id } }
      );
    }
  } catch (err) {
    console.warn('[FinancialPressure] Transaction log failed:', err.message);
  }
}

module.exports = {
  checkAffordability,
  recordDeclinedInvite,
  buildFinancialPressureContext,
  logTransaction,
};

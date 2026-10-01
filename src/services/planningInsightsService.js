'use strict';

/**
 * Planning Insights for the active season (Evoni's rulings, 2026-10-01;
 * docs/EVENT_EPISODE_FLOW.md §8(ff); build PR 8 of
 * docs/SEASON_ARC_DESIGN_NOTE.md).
 *
 *   A8. "A Planning Insights view compares planned pressure with actual
 *   results per slot. Season money (spend, income, balance trend) comes from
 *   the ledger only, never from cost_coins."
 *   Q13 (accepted). "Planning Insights' money: per slot, with phase totals.
 *   The balance trend counts every ledger row, so deals and purchases
 *   between episodes show."
 *   Q15 (accepted). "Season-health score: fold it into Planning Insights as
 *   one line, using the slot outcome ranges instead of the fixed 1/4/2/1
 *   targets."
 *
 * Money is read from financial_transactions through countedLedgerRows (the
 * rows Lala's balance counts), so it agrees with the balance and the
 * Episode Ledger. Nothing here reads cost_coins.
 */

const { countedLedgerRows } = require('../utils/ledgerBalanceFilter');
const { getRoadmap, PRESSURE_LEVELS } = require('./seasonSlotService');
const { OUTCOME_TIERS } = require('./seasonIntentionService');

// The newest ledger rows the trend returns; the running balance still
// counts every earlier row.
const TREND_LIMIT = 300;

const SIGNED = "CASE WHEN ft.type IN ('income', 'reward') THEN ft.amount WHEN ft.type IN ('expense', 'deduction') THEN -ft.amount ELSE 0 END";

/** Steps from the planned pressure to the actual (+ above, − below), or null. */
function pressureDelta(desired, actual) {
  const d = PRESSURE_LEVELS.indexOf(desired);
  const a = PRESSURE_LEVELS.indexOf(actual);
  return d < 0 || a < 0 ? null : a - d;
}

/** Whether an actual tier falls inside a slot's outcome range, or null when either is missing. */
function inRange(range, tier) {
  if (!range || !tier) return null;
  const lo = OUTCOME_TIERS.indexOf(range.min);
  const hi = OUTCOME_TIERS.indexOf(range.max);
  const t = OUTCOME_TIERS.indexOf(String(tier).toLowerCase());
  if (lo < 0 || hi < 0 || t < 0) return null;
  return t >= lo && t <= hi;
}

async function episodeMoney(sequelize, showId, episodeIds) {
  if (episodeIds.length === 0) return new Map();
  const [rows] = await sequelize.query(
    `SELECT ft.episode_id,
            COALESCE(SUM(CASE WHEN ft.type IN ('income', 'reward') THEN ft.amount ELSE 0 END), 0)::bigint AS income,
            COALESCE(SUM(CASE WHEN ft.type IN ('expense', 'deduction') THEN ft.amount ELSE 0 END), 0)::bigint AS spend
       FROM financial_transactions ft
      WHERE ft.show_id = :showId AND ft.episode_id IN (:episodeIds) AND ${countedLedgerRows('ft')}
      GROUP BY ft.episode_id`,
    { replacements: { showId, episodeIds } });
  return new Map(rows.map((r) => {
    const income = Number(r.income) || 0;
    const spend = Number(r.spend) || 0;
    return [r.episode_id, { income, spend, net: income - spend }];
  }));
}

/**
 * The balance after every counted ledger row, oldest first (Q13): episode
 * rows carry their slot's label; deals and purchases outside an episode
 * show as "between episodes".
 */
async function balanceTrend(sequelize, showId, labelByEpisode) {
  const [rows] = await sequelize.query(
    `SELECT * FROM (
       SELECT ft.id, ft.episode_id, ft.type, ft.category, ft.description, ft.created_at,
              (${SIGNED})::bigint AS signed_amount,
              SUM(${SIGNED}) OVER (ORDER BY ft.created_at ASC, ft.id ASC)::bigint AS balance_after,
              ROW_NUMBER() OVER (ORDER BY ft.created_at DESC, ft.id DESC) AS newest_rank
         FROM financial_transactions ft
        WHERE ft.show_id = :showId AND ${countedLedgerRows('ft')}
     ) t
     WHERE t.newest_rank <= :limit
     ORDER BY t.created_at ASC, t.id ASC`,
    { replacements: { showId, limit: TREND_LIMIT } });
  return rows.map((r) => ({
    at: r.created_at,
    amount: Number(r.signed_amount) || 0,
    balance_after: Number(r.balance_after) || 0,
    category: r.category,
    description: r.description,
    episode_id: r.episode_id,
    slot_label: r.episode_id ? (labelByEpisode.get(r.episode_id) || null) : null,
    between_episodes: !r.episode_id,
  }));
}

/**
 * The active season's Planning Insights: per slot, plan beside result and
 * money; per phase, money totals; the balance trend; and the season-health
 * line (Q15). Null when the show has no active season.
 */
async function getInsights(sequelize, showId) {
  const roadmap = await getRoadmap(sequelize, showId);
  if (!roadmap) return null;

  const allSlots = roadmap.phases.flatMap((p) => p.slots);
  const episodeIds = allSlots.filter((s) => s.episode).map((s) => s.episode.id);
  const money = await episodeMoney(sequelize, showId, episodeIds);
  const labelByEpisode = new Map(allSlots.filter((s) => s.episode).map((s) => [s.episode.id, s.label]));

  const slotInsight = (s) => {
    const planned = {
      desired_pressure: s.intention.desired_pressure || null,
      outcome_range: s.intention.outcome_range || null,
      story_purpose: s.intention.story_purpose || null,
    };
    const actual = {
      outcome: s.result.actual_outcome ? String(s.result.actual_outcome).toLowerCase() : null,
      pressure: s.result.actual_pressure || null,
    };
    return {
      slot_number: s.slot_number,
      label: s.label,
      phase: s.phase,
      state: s.state,
      episode: s.episode ? { id: s.episode.id, title: s.episode.title } : null,
      planned,
      actual,
      pressure_delta: pressureDelta(planned.desired_pressure, actual.pressure),
      outcome_in_range: inRange(planned.outcome_range, actual.outcome),
      money: s.episode ? (money.get(s.episode.id) || { income: 0, spend: 0, net: 0 }) : null,
    };
  };

  // Only slots with a plan, an episode or a result are listed; the rest are
  // counted, so 24 empty rows do not bury the ones that say something.
  const hasSomething = (i) => i.episode || i.planned.desired_pressure || i.planned.outcome_range || i.actual.outcome;
  const phases = roadmap.phases.map((p) => {
    const slots = p.slots.map(slotInsight);
    const totals = slots.reduce((acc, i) => {
      if (!i.money) return acc;
      acc.income += i.money.income;
      acc.spend += i.money.spend;
      acc.net += i.money.net;
      return acc;
    }, { income: 0, spend: 0, net: 0 });
    return {
      phase: p.phase,
      title: p.title,
      status: p.status,
      episode_start: p.episode_start,
      episode_end: p.episode_end,
      totals,
      slots: slots.filter(hasSomething),
      unplanned_count: slots.filter((i) => !hasSomething(i)).length,
    };
  });

  // Q15: the season's health is how many accepted episodes landed inside
  // their slot's planned outcome range.
  const accepted = phases.flatMap((p) => p.slots).filter((i) => i.actual.outcome);
  const judged = accepted.filter((i) => i.outcome_in_range !== null);
  const health = {
    accepted: accepted.length,
    with_range: judged.length,
    in_range: judged.filter((i) => i.outcome_in_range).length,
    without_range: accepted.length - judged.length,
  };

  const trend = await balanceTrend(sequelize, showId, labelByEpisode);
  const season = phases.reduce((acc, p) => ({
    income: acc.income + p.totals.income, spend: acc.spend + p.totals.spend, net: acc.net + p.totals.net,
  }), { income: 0, spend: 0, net: 0 });

  return {
    arc: roadmap.arc,
    season_number: roadmap.season_number,
    phases,
    money: {
      season,
      balance: trend.length ? trend[trend.length - 1].balance_after : null,
      trend,
      trend_limit: TREND_LIMIT,
    },
    health,
  };
}

module.exports = {
  TREND_LIMIT,
  pressureDelta,
  inRange,
  getInsights,
};

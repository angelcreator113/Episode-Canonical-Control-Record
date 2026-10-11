'use strict';

/**
 * The episode's estimated money, recomputed the way Start writes it today
 * (Task #1919 backfill; Evoni's ruling 2026-10-11).
 *
 * Before #2902, Start Episode priced every item in the show's closet as the
 * outfit, so an episode's total_expenses and its todo list's
 * financial_summary carried the closet's value. Start now prices the chosen
 * look only (episodeGeneratorService loadFinancialWardrobeItems +
 * calculateFinancials). This rewrites an existing episode's stored estimate
 * with that same rule, for the episode's one event (utils/episodeEventSql):
 *   - episodes.total_income, total_expenses, financial_score
 *   - episode_todo_lists.financial_summary
 * the same fields, with the same values, Start and the terms relock
 * (termsReopenService relockTerms) write.
 *
 * Never touched:
 *   - a finalized episode: Finalize replaced its totals with the ledger's
 *     (its own financial_transactions rows, NOT_WARDROBE_SPEND_ROW);
 *   - an episode whose event's terms are reopened: the relock recomputes it;
 *   - an episode Start never estimated (no todo list financial_summary):
 *     made by hand or by inject, its totals were never Start's to fix;
 *   - an episode with no event, or whose estimate already matches;
 *   - the ledger (financial_transactions) and Lala's balance.
 *
 * Run only by Evoni, through scripts/backfill-episode-estimates.js.
 */

const { EPISODE_EVENT_ID_SQL } = require('../utils/episodeEventSql');
const { NOT_WARDROBE_SPEND_ROW } = require('./financialTransactionService');
const { reopenMarkerOf } = require('../utils/eventTermsLock');
const { calculateFinancials, loadFinancialWardrobeItems } = require('./episodeGeneratorService');

const STATUS = {
  CHANGED: 'changed',
  UNCHANGED: 'unchanged',
  FINALIZED: 'skipped_finalized',
  REOPENED: 'skipped_terms_reopened',
  NO_EVENT: 'skipped_no_event',
  NO_ESTIMATE: 'skipped_no_estimate',
  MISSING: 'skipped_missing',
};

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const parseObject = (v) => {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch (err) {
    console.error('[EstimateBackfill] financial_summary is not JSON:', err.message);
    return null;
  }
};

/** Live episodes of the show (or all shows), oldest first: the ids to plan. */
async function listEpisodeIds(sequelize, { ids = null, showId = null, limit = null } = {}) {
  const where = ['deleted_at IS NULL'];
  if (ids?.length) where.push('id IN (:ids)');
  if (showId) where.push('show_id = :showId');
  const [rows] = await sequelize.query(
    `SELECT id FROM episodes WHERE ${where.join(' AND ')} ORDER BY created_at ASC${limit ? ' LIMIT :limit' : ''}`,
    { replacements: { ids, showId, limit } }
  );
  return rows.map((r) => r.id);
}

/**
 * What the backfill would do to one episode: { episode_id, status, before,
 * after }. `after` is what Start writes today; `before` what is stored.
 * Reads only.
 */
async function planEpisodeEstimate(sequelize, episodeId, { transaction = null } = {}) {
  const base = { episode_id: episodeId };
  const [[episode]] = await sequelize.query(
    `SELECT id, show_id, title, episode_number, total_income, total_expenses, financial_score
       FROM episodes WHERE id = :episodeId AND deleted_at IS NULL`,
    { replacements: { episodeId }, transaction }
  );
  if (!episode) return { ...base, status: STATUS.MISSING };
  Object.assign(base, { show_id: episode.show_id, title: episode.title, episode_number: episode.episode_number });

  const [[finalized]] = await sequelize.query(
    `SELECT COUNT(*)::int AS cnt FROM financial_transactions
      WHERE episode_id = :episodeId AND status = 'executed' AND deleted_at IS NULL AND ${NOT_WARDROBE_SPEND_ROW}`,
    { replacements: { episodeId }, transaction }
  );
  if (finalized.cnt > 0) return { ...base, status: STATUS.FINALIZED };

  const [[event]] = await sequelize.query(
    `SELECT * FROM world_events WHERE id = ${EPISODE_EVENT_ID_SQL}`,
    { replacements: { episodeId }, transaction }
  );
  if (!event) return { ...base, status: STATUS.NO_EVENT };
  if (reopenMarkerOf(event.canon_consequences)) return { ...base, status: STATUS.REOPENED, event_id: event.id };

  const [[todo]] = await sequelize.query(
    `SELECT id, financial_summary FROM episode_todo_lists
      WHERE episode_id = :episodeId AND deleted_at IS NULL LIMIT 1`,
    { replacements: { episodeId }, transaction }
  );
  const summary = todo ? parseObject(todo.financial_summary) : null;
  if (!summary) return { ...base, status: STATUS.NO_ESTIMATE, event_id: event.id };

  const wardrobeItems = await loadFinancialWardrobeItems(sequelize, episode.show_id, { transaction, event, episodeId });
  const financials = calculateFinancials(event, wardrobeItems ?? null);
  const after = {
    total_income: financials.total_income,
    total_expenses: financials.total_expenses,
    financial_score: financials.net_profit >= 0 ? 7 : 4,
    financial_summary: financials,
  };
  const before = {
    total_income: num(episode.total_income),
    total_expenses: num(episode.total_expenses),
    financial_score: num(episode.financial_score),
    financial_summary: summary,
  };

  const sameEpisode = before.total_income === after.total_income
    && before.total_expenses === after.total_expenses
    && before.financial_score === after.financial_score;
  const sameSummary = num(summary.total_expenses) === financials.total_expenses
    && num(summary.total_income) === financials.total_income
    && (summary.outfit_cost ?? null) === financials.outfit_cost
    && summary.outfit_chosen === financials.outfit_chosen;

  return {
    ...base,
    event_id: event.id,
    todo_list_id: todo.id,
    status: sameEpisode && sameSummary ? STATUS.UNCHANGED : STATUS.CHANGED,
    before,
    after,
  };
}

/**
 * Rewrite one episode's estimate when the plan says it changed. Plans again
 * inside the transaction, so a Finalize or a reopen since the dry run is
 * respected. Returns the plan.
 */
async function applyEpisodeEstimate(sequelize, episodeId) {
  return sequelize.transaction(async (transaction) => {
    await sequelize.query('SELECT id FROM episodes WHERE id = :episodeId FOR UPDATE',
      { replacements: { episodeId }, transaction });
    const plan = await planEpisodeEstimate(sequelize, episodeId, { transaction });
    if (plan.status !== STATUS.CHANGED) return plan;

    await sequelize.query(
      `UPDATE episodes SET total_income = :total_income, total_expenses = :total_expenses,
              financial_score = :financial_score, updated_at = NOW()
        WHERE id = :episodeId`,
      { replacements: {
        episodeId,
        total_income: plan.after.total_income,
        total_expenses: plan.after.total_expenses,
        financial_score: plan.after.financial_score,
      }, transaction }
    );
    await sequelize.query(
      `UPDATE episode_todo_lists SET financial_summary = CAST(:fin AS jsonb), updated_at = NOW()
        WHERE id = :id`,
      { replacements: { id: plan.todo_list_id, fin: JSON.stringify(plan.after.financial_summary) }, transaction }
    );
    return plan;
  });
}

module.exports = { STATUS, listEpisodeIds, planEpisodeEstimate, applyEpisodeEstimate };

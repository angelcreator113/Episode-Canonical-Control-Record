'use strict';

/**
 * Episode Money, Phase A: a read-only view of the ledger for one episode
 * (docs/EVENT_EPISODE_FLOW.md §8(aa) M1–M5; Task #2278).
 *
 * - M4: Episode Money is a view of the ledger, not a separate ledger. The
 *   balance is getCurrentBalance; the rows are the episode's counted ledger
 *   rows (M6: no voided row, no deleted episode's row); the net is their sum.
 * - M2: planned amounts never enter the ledger. The source event's accepted
 *   terms are returned as `expected` lines, apart from the rows, and are never
 *   added to the balance or the net.
 *
 * Phase B (§8(gg) MB1–MB3; episodeMoneyLines): `lines` is every money
 * line of the episode with its trigger, payer and state (Planned, Pending,
 * Posted), matched to its posted row by category and source; `unplanned`
 * the posted rows no line matches; `projection` the projected net and
 * balance. `expected` stays as Phase A returned it. No recap (Phase C).
 *
 * Event spending (the event cost split ruling, 2026-09-30): the episode's
 * spending lines (episodeSpendingService), each quantity × unit price with
 * its Auto-drafted or Edited state, editable until Complete. They are
 * returned as `spending`, apart from `expected` (the terms), and never added
 * to the balance or the net until Complete charges them.
 */

const { countedLedgerRows } = require('../utils/ledgerBalanceFilter');
const { wholeCoins } = require('../utils/wholeCoins');

const INCOME_TYPES = new Set(['income', 'reward']);

/**
 * The episode's source event (§8(w) P2): the event its live brief names, else
 * the event whose used_in_episode_id points at it.
 */
async function findSourceEvent(sequelize, episodeId) {
  const [fromBrief] = await sequelize.query(
    `SELECT w.* FROM episode_briefs b
       JOIN world_events w ON w.id = b.event_id
      WHERE b.episode_id = :episodeId AND b.deleted_at IS NULL AND w.deleted_at IS NULL
      ORDER BY b.created_at DESC LIMIT 1`,
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  );
  if (fromBrief) return fromBrief;
  const [fromEvent] = await sequelize.query(
    `SELECT * FROM world_events
      WHERE used_in_episode_id = :episodeId AND deleted_at IS NULL
      ORDER BY updated_at DESC LIMIT 1`,
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  );
  return fromEvent || null;
}

/**
 * The accepted terms as expected lines (M2): never posted, never summed.
 * A deal event has no entry cost; its expected costs are the itemised rows
 * Lala pays (`costs`, deal build PR 4, Task #2365). Comped rows are not
 * lines here: Lala never pays them. Its expected income (deal build PR 5)
 * is each component it is paid at Complete and each deliverable's content
 * fee, paid on approval (`deliverables`).
 */
function expectedLines(event, costs = [], deliverables = []) {
  if (!event) return [];
  const { normalizePaidFreeFlags } = require('./financialTransactionService');
  const { isPaid, eventCost, eventPayment } = normalizePaidFreeFlags(event);
  const lines = [];
  if (isPaid && eventPayment > 0) {
    lines.push({ kind: 'income', label: 'Event payment', amount: wholeCoins(eventPayment), source: 'terms' });
  }
  if (eventCost > 0) {
    lines.push({ kind: 'expense', label: 'Entry cost', amount: wholeCoins(eventCost), source: 'terms' });
  }
  const { completionPayouts, contentFeeFor } = require('./dealPayoutService');
  for (const p of completionPayouts(event, null)) {
    const label = p.category === 'appearance_fee' ? 'Appearance fee'
      : p.category === 'partnership_base_fee' ? 'Partnership base' : 'Performance fee';
    lines.push({ kind: 'income', label, amount: wholeCoins(p.amount), source: 'terms' });
  }
  for (const d of deliverables) {
    const fee = contentFeeFor(event, d);
    if (fee > 0) lines.push({ kind: 'income', label: `Content fee: ${d.description || 'deliverable'}`, amount: wholeCoins(fee), source: 'terms' });
  }
  const { chargeableCosts } = require('./eventCostsService');
  for (const cost of chargeableCosts(costs)) {
    lines.push({ kind: 'expense', label: cost.label || cost.kind, amount: wholeCoins(cost.amount), source: 'terms' });
  }
  return lines;
}

/** The episode's event spending: its lines, their total, and whether they can still be edited. */
async function spendingView(sequelize, episodeId) {
  const { listSpending, spendingDraftState, isEpisodeCompleted } = require('./episodeSpendingService');
  const lines = (await listSpending(sequelize, episodeId)).map((l) => ({
    id: l.id,
    label: l.label,
    quantity: l.quantity,
    unit_price: l.unit_price,
    total: l.total,
    source: l.source,
    draft_state: spendingDraftState(l),
    drafted_quantity: l.drafted_quantity,
    drafted_unit_price: l.drafted_unit_price,
  }));
  return {
    lines,
    total: lines.reduce((sum, l) => sum + l.total, 0),
    editable: !(await isEpisodeCompleted(sequelize, episodeId)),
  };
}

/**
 * @returns {Promise<null | {
 *   episode_id, show_id, balance, rows, net,
 *   event: null | { id, name }, expected,
 *   spending: { lines, total, editable },
 *   lines, unplanned, projection, warnings, reconciliation
 * }>} null when the episode is missing, deleted, or of another show.
 */
/**
 * Lala's look as Finalize will charge it (episodeLookCharges), for the
 * plan's "Lala's look" lines (Evoni, 2026-10-06). A piece of the look
 * already paid for in this episode (bought in the styling game, or charged
 * by Finalize) is listed at what it posted, so its line reads Posted.
 * Finalize charges the look only for an episode with an event, so without
 * one there is none. Returns { pieces, charges }.
 */
async function lookPlan(sequelize, { showId, episodeId, event, rows = [] }) {
  if (!event) return { pieces: 0, charges: [] };
  const { loadLookPieces, boughtPieceIds, lookCharges } = require('./episodeLookCharges');
  const pieces = await loadLookPieces(sequelize, { episodeId, event });
  const charges = lookCharges(pieces, await boughtPieceIds(sequelize, { showId, episodeId, pieces }));
  const listed = new Set(charges.map((c) => `${c.category}|${c.piece.id}`));
  const byId = new Map(pieces.map((p) => [String(p.id), p]));
  for (const r of rows) {
    if (r.category !== 'wardrobe_purchase' && r.category !== 'wardrobe_rental') continue;
    const piece = r.source_id != null ? byId.get(String(r.source_id)) : null;
    const key = `${r.category}|${r.source_id}`;
    if (!piece || listed.has(key)) continue;
    listed.add(key);
    charges.push({ category: r.category, piece, amount: Math.abs(Number(r.amount) || 0) });
  }
  return { pieces: pieces.length, charges };
}

async function getEpisodeMoney(sequelize, { showId, episodeId }) {
  const [episode] = await sequelize.query(
    'SELECT id, show_id, money_plan FROM episodes WHERE id = :episodeId AND deleted_at IS NULL',
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  );
  if (!episode || String(episode.show_id) !== String(showId)) return null;

  const { getCurrentBalance } = require('./financialTransactionService');
  const balance = await getCurrentBalance(sequelize, showId);

  const rows = await sequelize.query(
    `SELECT ft.id, ft.created_at, ft.category, ft.type, ft.description, ft.amount, ft.source_id, ft.metadata
       FROM financial_transactions ft
      WHERE ft.show_id = :showId AND ft.episode_id = :episodeId AND ${countedLedgerRows('ft')}
      ORDER BY ft.created_at, ft.id`,
    { replacements: { showId, episodeId }, type: sequelize.QueryTypes.SELECT }
  );
  const posted = rows.map((r) => {
    const amount = wholeCoins(r.amount);
    return {
      id: r.id,
      date: r.created_at,
      category: r.category,
      description: r.description,
      type: r.type,
      amount,
      signed: INCOME_TYPES.has(r.type) ? amount : -amount,
      source_id: r.source_id || null,
      metadata: r.metadata || null,
    };
  });
  const net = posted.reduce((sum, r) => sum + r.signed, 0);

  const event = await findSourceEvent(sequelize, episodeId);
  const { isDealEvent, listEventCosts } = require('./eventCostsService');
  const costs = isDealEvent(event) ? await listEventCosts(sequelize, event.id) : [];
  const { listEventDeliverables } = require('./eventTermsService');
  const deliverables = isDealEvent(event) ? await listEventDeliverables(sequelize, event.id) : [];
  const spending = await spendingView(sequelize, episodeId);

  // Phase B (§8(gg) MB1–MB3): the lines, their states and the projection.
  const { listSpending, hadSpendingLines } = require('./episodeSpendingService');
  const { plannedLines, buildMoneyLines, moneyWarnings } = require('./episodeMoneyLines');
  const look = await lookPlan(sequelize, { showId, episodeId, event, rows: posted });
  const plan = plannedLines({
    event,
    costs,
    deliverables,
    spending: await listSpending(sequelize, episodeId),
    hadSpending: await hadSpendingLines(sequelize, episodeId),
    look: look.charges,
  });
  const { lines, unplanned, projection } = buildMoneyLines({
    plan, rows: posted, balance, completed: !spending.editable,
  });

  return {
    episode_id: episode.id,
    show_id: episode.show_id,
    balance,
    rows: posted,
    net,
    event: event ? { id: event.id, name: event.name } : null,
    expected: expectedLines(event, costs, deliverables),
    spending,
    lines,
    unplanned,
    projection,
    // Lala's look: how many pieces it holds (0: not chosen yet).
    look: { pieces: look.pieces },
    // MB4: early warnings, never blocking.
    warnings: moneyWarnings({ lines, projection, balance }),
    // MB6: after Complete, the plan saved at Start Episode beside what posted.
    reconciliation: spending.editable ? null : reconciliationFor(episode.money_plan, { lines, unplanned }),
  };
}

function parsePlan(value) {
  if (value == null) return null;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[EpisodeMoney] money_plan JSON parse failed:', err.message);
    return null;
  }
}

/**
 * MB6 (Q7): compare the plan saved at Start Episode with what posted. An
 * episode started before the plan was saved has none; it is compared with
 * its lines as they stand, and `basis` says so.
 */
function reconciliationFor(moneyPlan, { lines, unplanned }) {
  const { reconcile } = require('./episodeMoneyLines');
  const saved = parsePlan(moneyPlan);
  const plan = saved && Array.isArray(saved.lines) ? saved.lines : lines;
  return {
    basis: saved && Array.isArray(saved.lines) ? 'start_episode' : 'current',
    planned_at: saved?.taken_at || null,
    ...reconcile({ plan, lines, unplanned }),
  };
}

/**
 * MB6 (Q7): saves the episode's money lines as they stand at Start Episode
 * on episodes.money_plan. Runs after Start Episode's transaction (its
 * spending lines are drafted and its deliverables stamped by then); a
 * failure is the caller's to log. Returns the plan, or null when the episode
 * is not found.
 */
async function snapshotMoneyPlan(sequelize, { showId, episodeId }) {
  const money = await getEpisodeMoney(sequelize, { showId, episodeId });
  if (!money) return null;
  const { planSnapshot } = require('./episodeMoneyLines');
  const plan = planSnapshot({ lines: money.lines, balance: money.balance });
  await sequelize.query(
    'UPDATE episodes SET money_plan = CAST(:plan AS jsonb), updated_at = NOW() WHERE id = :episodeId',
    { replacements: { plan: JSON.stringify(plan), episodeId } });
  return plan;
}

/**
 * The money an event's episode would carry, before Start Episode makes it
 * (MB4: "Start Episode/Complete warn early"): its accepted terms as lines,
 * nothing posted, and the warnings against Lala's ledger balance. When
 * `episodeId` is given (Save and relock after a reopen), that episode's
 * spending lines are planned too; otherwise a legacy event's extras stand
 * in for the spending Start Episode will draft.
 */
async function eventMoneyPreview(sequelize, { showId, event, episodeId = null, transaction } = {}) {
  const { getCurrentBalance } = require('./financialTransactionService');
  const balance = await getCurrentBalance(sequelize, showId);
  const { isDealEvent, listEventCosts } = require('./eventCostsService');
  const { listEventDeliverables } = require('./eventTermsService');
  const deal = isDealEvent(event);
  const costs = deal ? await listEventCosts(sequelize, event.id, { transaction }) : [];
  const deliverables = deal ? await listEventDeliverables(sequelize, event.id, { transaction }) : [];
  const { listSpending, hadSpendingLines } = require('./episodeSpendingService');
  const spending = episodeId ? await listSpending(sequelize, episodeId, { transaction }) : [];
  const hadSpending = episodeId ? await hadSpendingLines(sequelize, episodeId, { transaction }) : false;
  const { plannedLines, buildMoneyLines, moneyWarnings } = require('./episodeMoneyLines');
  // The look's to-buy pieces are planned here too, as on the Money tab: the
  // preview used to leave them out (Evoni, 2026-10-07).
  const look = await lookPlan(sequelize, { showId, episodeId, event });
  const plan = plannedLines({ event, costs, deliverables, spending, hadSpending, look: look.charges });
  const { lines, projection } = buildMoneyLines({ plan, rows: [], balance });
  return { balance, lines, projection, warnings: moneyWarnings({ lines, projection, balance }) };
}

module.exports = { getEpisodeMoney, eventMoneyPreview, snapshotMoneyPlan, findSourceEvent, expectedLines };

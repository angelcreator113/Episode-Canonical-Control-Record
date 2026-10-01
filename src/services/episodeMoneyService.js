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
 *   lines, unplanned, projection
 * }>} null when the episode is missing, deleted, or of another show.
 */
async function getEpisodeMoney(sequelize, { showId, episodeId }) {
  const [episode] = await sequelize.query(
    'SELECT id, show_id FROM episodes WHERE id = :episodeId AND deleted_at IS NULL',
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
  const { plannedLines, buildMoneyLines } = require('./episodeMoneyLines');
  const plan = plannedLines({
    event,
    costs,
    deliverables,
    spending: await listSpending(sequelize, episodeId),
    hadSpending: await hadSpendingLines(sequelize, episodeId),
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
  };
}

module.exports = { getEpisodeMoney, findSourceEvent, expectedLines };

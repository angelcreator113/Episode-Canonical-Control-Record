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
 * Phase A has no planned or pending states (Phase B) and no recap (Phase C).
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

/** The accepted terms as expected lines (M2): never posted, never summed. */
function expectedLines(event) {
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
  return lines;
}

/**
 * @returns {Promise<null | {
 *   episode_id, show_id, balance, rows, net,
 *   event: null | { id, name }, expected
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
    `SELECT ft.id, ft.created_at, ft.category, ft.type, ft.description, ft.amount
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
    };
  });
  const net = posted.reduce((sum, r) => sum + r.signed, 0);

  const event = await findSourceEvent(sequelize, episodeId);
  return {
    episode_id: episode.id,
    show_id: episode.show_id,
    balance,
    rows: posted,
    net,
    event: event ? { id: event.id, name: event.name } : null,
    expected: expectedLines(event),
  };
}

module.exports = { getEpisodeMoney, findSourceEvent, expectedLines };

'use strict';

/**
 * Event spending (Evoni's event cost split ruling, 2026-09-30,
 * docs/EVENT_EPISODE_FLOW.md §8(cc), §8(aa)); build PR 4 of
 * docs/DEAL_COMPONENTS_DESIGN.md §6.
 *
 * "Event costs split in two. Terms costs (entry, ticket, travel, anything
 * the deal itself involves) stay in the Event Package and lock at Start
 * Episode. Event spending (drinks, valet, photo booth and other things Lala
 * chooses during the event) lives in the episode's Money tab, editable
 * until Complete, each line quantity × unit price, auto-drafted from the
 * event's extras as suggestions, charged at Complete like other costs."
 *
 * Answers of the same day: glam and styling stay terms costs; only the
 * `extras` kind moves; the accepted extras migration plan (carried rows keep
 * their amount and their Auto-drafted or Edited state; completed episodes
 * are untouched; an event with no episode is moved at Start Episode).
 *
 * The lines are episode_spending_lines rows (EpisodeSpendingLine.js):
 *   - Start Episode drafts them (draftEpisodeSpending): the event's live
 *     extras cost rows are carried (and soft-deleted), else a replaced
 *     episode's lines are copied, else the event's extras by prestige are
 *     drafted as suggestions (financialRates.eventExtrasFor). This holds
 *     for legacy events too: their hidden styling_extras lump becomes lines.
 *   - The Money tab edits them until Complete (the episode's evaluation is
 *     accepted); then they are read-only.
 *   - Complete charges each as its own expense (category event_spending,
 *     source_type 'event_spending', source_id the line; Law 13), in
 *     financialTransactionService.finalizeEpisodeFinancials.
 */

const { v4: uuidv4 } = require('uuid');

const LABEL_MAX = 200;
const QUANTITY_MAX = 999;
const SPENDING_CATEGORY = 'event_spending';

const LINE_COLUMNS = `id, episode_id, event_id, label, quantity, unit_price, source, source_cost_id,
  drafted_quantity, drafted_unit_price, created_at, updated_at`;

// The drafted extras, in order: key, label (as eventCostsService drafted them).
const EXTRAS_LINES = Object.freeze([
  { key: 'drinks', label: 'Drinks' },
  { key: 'valet', label: 'Valet' },
  { key: 'photo_booth', label: 'Photo booth' },
]);

const whole = (n) => (Number.isFinite(Number(n)) ? Math.trunc(Number(n)) : 0);

function normalizeLine(r) {
  const quantity = whole(r.quantity);
  const unitPrice = whole(r.unit_price);
  return {
    ...r,
    quantity,
    unit_price: unitPrice,
    total: quantity * unitPrice,
    drafted_quantity: r.drafted_quantity == null ? null : whole(r.drafted_quantity),
    drafted_unit_price: r.drafted_unit_price == null ? null : whole(r.drafted_unit_price),
  };
}

/** The episode's live spending lines, oldest first, each with its total. */
async function listSpending(sequelize, episodeId, { transaction } = {}) {
  const [rows] = await sequelize.query(
    `SELECT ${LINE_COLUMNS} FROM episode_spending_lines
      WHERE episode_id = :episodeId AND deleted_at IS NULL
      ORDER BY created_at ASC, id ASC`,
    { replacements: { episodeId }, transaction }
  );
  return (rows || []).map(normalizeLine);
}

/**
 * Whether the episode ever had spending lines, deleted ones included: a
 * legacy event's styling_extras lump is charged only when it never did.
 */
async function hadSpendingLines(sequelize, episodeId, { transaction } = {}) {
  const [rows] = await sequelize.query(
    'SELECT 1 FROM episode_spending_lines WHERE episode_id = :episodeId LIMIT 1',
    { replacements: { episodeId }, transaction }
  );
  return Boolean(rows?.length);
}

/** The lines Complete charges: a total above 0. */
function chargeableSpending(lines) {
  return (lines || []).map(normalizeLine).filter((l) => l.total > 0);
}

/** 'auto_drafted' | 'edited' | null (added by hand): the rule 14 state of a line. */
function spendingDraftState(line) {
  if (line.drafted_quantity == null || line.drafted_unit_price == null) return null;
  return whole(line.quantity) === whole(line.drafted_quantity) && whole(line.unit_price) === whole(line.drafted_unit_price)
    ? 'auto_drafted' : 'edited';
}

/**
 * Validates a line body. `partial` (PUT) allows any subset; POST needs a
 * label and a unit price. Returns { fields } or { error }.
 */
function readSpendingBody(body, { partial }) {
  const b = body && typeof body === 'object' ? body : {};
  const fields = {};
  if (b.label !== undefined || !partial) {
    const label = typeof b.label === 'string' ? b.label.trim() : '';
    if (!label) return { error: 'label is required' };
    if (label.length > LABEL_MAX) return { error: `label must be at most ${LABEL_MAX} characters` };
    fields.label = label;
  }
  if (b.quantity !== undefined || !partial) {
    const q = b.quantity === undefined ? 1 : Number(b.quantity);
    if (!Number.isInteger(q) || q < 1 || q > QUANTITY_MAX) return { error: `quantity must be a whole number from 1 to ${QUANTITY_MAX}` };
    fields.quantity = q;
  }
  if (b.unit_price !== undefined || !partial) {
    const p = Number(b.unit_price);
    if (b.unit_price === null || b.unit_price === '' || !Number.isInteger(p) || p < 0) {
      return { error: 'unit_price must be a whole number of Prime Coins, 0 or more' };
    }
    fields.unit_price = p;
  }
  return { fields };
}

/** Whether the episode is completed (its evaluation accepted): the lines are then read-only. */
async function isEpisodeCompleted(sequelize, episodeId, { transaction } = {}) {
  const [rows] = await sequelize.query(
    'SELECT evaluation_status FROM episodes WHERE id = :episodeId LIMIT 1',
    { replacements: { episodeId }, transaction }
  );
  return rows?.[0]?.evaluation_status === 'accepted';
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[EpisodeSpending] JSON parse failed:', err.message);
    return fallback;
  }
}

async function insertLine(sequelize, line, { transaction } = {}) {
  const [rows] = await sequelize.query(
    `INSERT INTO episode_spending_lines (id, episode_id, event_id, label, quantity, unit_price, source, source_cost_id,
       drafted_quantity, drafted_unit_price, created_at, updated_at)
     VALUES (:id, :episodeId, :eventId, :label, :quantity, :unitPrice, :source, :sourceCostId,
       :draftedQuantity, :draftedUnitPrice, clock_timestamp(), clock_timestamp())
     RETURNING ${LINE_COLUMNS}`,
    {
      replacements: {
        id: uuidv4(),
        episodeId: line.episode_id,
        eventId: line.event_id ?? null,
        label: String(line.label).slice(0, LABEL_MAX),
        quantity: line.quantity ?? 1,
        unitPrice: line.unit_price ?? 0,
        source: line.source ?? null,
        sourceCostId: line.source_cost_id ?? null,
        draftedQuantity: line.drafted_quantity ?? null,
        draftedUnitPrice: line.drafted_unit_price ?? null,
      },
      transaction,
    }
  );
  return rows?.[0] ? normalizeLine(rows[0]) : null;
}

/**
 * Start Episode: the episode's spending lines, drafted once (an episode
 * that already has lines is left alone). In order of preference:
 *   1. the event's live extras cost rows, carried: one line each at 1 × its
 *      amount, keeping its drafted copy (so an edited amount reads Edited),
 *      and the row soft-deleted so it is not also a terms cost;
 *   2. a replaced episode's live lines, copied;
 *   3. the event's extras by prestige (eventExtrasFor), drafted as
 *      suggestions (source 'extras').
 * Runs in the caller's transaction. Returns the lines written.
 */
async function draftEpisodeSpending(sequelize, { event, episodeId, replacingEpisodeId = null, transaction } = {}) {
  if (!event || !episodeId) return [];
  if ((await listSpending(sequelize, episodeId, { transaction })).length) return [];

  const written = [];
  const [costRows] = await sequelize.query(
    `SELECT id, label, amount FROM event_costs
      WHERE event_id = :eventId AND kind = 'extras' AND deleted_at IS NULL
      ORDER BY created_at ASC, id ASC`,
    { replacements: { eventId: event.id }, transaction }
  );
  if (costRows?.length) {
    const drafted = parseJson(event.canon_consequences, {})?.automation?.drafted_values?.costs || {};
    for (const c of costRows) {
      const record = drafted[c.id];
      const draftedAmount = record && record.amount != null ? whole(record.amount) : null;
      const line = await insertLine(sequelize, {
        episode_id: episodeId, event_id: event.id, label: c.label || 'Extras',
        quantity: 1, unit_price: whole(c.amount), source: 'carried', source_cost_id: c.id,
        drafted_quantity: draftedAmount == null ? null : 1, drafted_unit_price: draftedAmount,
      }, { transaction });
      await sequelize.query('UPDATE event_costs SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id',
        { replacements: { id: c.id }, transaction });
      if (line) written.push(line);
    }
    return written;
  }

  if (replacingEpisodeId) {
    const previous = await listSpending(sequelize, replacingEpisodeId, { transaction });
    if (previous.length) {
      for (const p of previous) {
        const line = await insertLine(sequelize, {
          ...p, episode_id: episodeId, event_id: event.id,
        }, { transaction });
        if (line) written.push(line);
      }
      return written;
    }
  }

  const { eventExtrasFor } = require('../utils/financialRates');
  const extras = eventExtrasFor(event);
  for (const x of EXTRAS_LINES) {
    const amount = whole(extras[x.key]);
    if (amount <= 0) continue;
    const line = await insertLine(sequelize, {
      episode_id: episodeId, event_id: event.id, label: x.label,
      quantity: 1, unit_price: amount, source: 'extras', drafted_quantity: 1, drafted_unit_price: amount,
    }, { transaction });
    if (line) written.push(line);
  }
  return written;
}

module.exports = {
  LABEL_MAX,
  QUANTITY_MAX,
  SPENDING_CATEGORY,
  EXTRAS_LINES,
  listSpending,
  hadSpendingLines,
  chargeableSpending,
  spendingDraftState,
  readSpendingBody,
  isEpisodeCompleted,
  insertLine,
  draftEpisodeSpending,
};

'use strict';

/**
 * Itemised event costs (deal build PR 4, Task #2365; docs/DEAL_DESIGN.md §5,
 * Law 7).
 *
 * A deal event's costs are rows in event_costs, one per cost, each saying
 * who pays it:
 *   paid_by 'lala'           — Finalize charges it as its own expense
 *                              (category event_cost, source_type
 *                              'event_cost', source_id the row; Law 13);
 *   paid_by 'host' | 'brand' — comped: recorded, never charged (Law 6).
 *
 * For a deal event Finalize no longer charges cost_coins as the entry cost
 * (it stays as difficulty only, Law 0) nor the hidden styling_extras row.
 *
 * The event cost split (Evoni, 2026-09-30, §8(cc)): these rows are the
 * terms costs (entry, ticket, travel, anything the deal itself involves).
 * The extras (drinks, valet, photo booth) are event spending now, lines on
 * the episode's Money tab (episodeSpendingService), so the draft here no
 * longer adds them. An `extras` row still on an event (drafted before the
 * split, or added by hand) is carried into the episode's spending at Start
 * Episode.
 *
 * The entry line (Evoni, 2026-09-30, answer 2; DEAL_DESIGN.md §10.3): a
 * self-funded deal is one where Lala pays to be in the room, so the draft
 * also adds an "Entry / ticket" row at the event's cost_coins, paid by Lala.
 * An invited/comped deal gets the same line comped by the host, so the
 * saving is visible. No other deal type drafts it; elsewhere cost_coins
 * stays difficulty only.
 *
 * A drafted row is recorded as other drafted values are (doctrine rule 14):
 * automation.auto_drafted.costs = 'extras' and
 * automation.drafted_values.costs = { <row id>: { key, amount, source } },
 * source 'extras' or 'event_cost'. It reads "Auto-drafted · event extras"
 * or "Auto-drafted · from event cost" until its amount changes, then
 * Edited.
 *
 * Legacy events (deal_type null) keep cost_coins and styling_extras (D8).
 * The rows lock with the terms (D4): the cost routes refuse a write once
 * findTermsLockEpisode finds the episode.
 */

const { v4: uuidv4 } = require('uuid');
const { COST_KINDS, COST_PAID_BY } = require('../models/EventCost');

const LABEL_MAX = 200;
const EXTRAS_SOURCE = 'extras';
const ENTRY_SOURCE = 'event_cost';

// The entry line's payer by deal type (answer 2); other deal types draft none.
const ENTRY_PAYER_BY_DEAL = Object.freeze({ self_funded: 'lala', invited_comped: 'host' });

/**
 * The entry line's payer from the deal's components (D14; answer 3,
 * 2026-09-30: "A cash deal without 'entry covered' drafts no entry line;
 * only self-funded deals draft an entry Lala pays."): 'lala' for a deal
 * with no components, 'host' (comped) when entry is covered, else none.
 */
function entryPayerFor(event) {
  const { dealPlanOf } = require('../utils/dealComponents');
  const plan = dealPlanOf(event);
  if (!plan) return null;
  if (plan.selfFunded) return 'lala';
  if (plan.entryCovered) return 'host';
  return null;
}

// The drafted extras, in order: key, label.
const EXTRAS_LINES = Object.freeze([
  { key: 'drinks', label: 'Drinks' },
  { key: 'valet', label: 'Valet' },
  { key: 'photo_booth', label: 'Photo booth' },
]);

const COST_COLUMNS = 'id, event_id, kind, label, amount, paid_by, created_at, updated_at';

/** A deal event is one with deal components (or, before D14, a deal type); legacy events have neither. */
function isDealEvent(event) {
  return require('../utils/dealComponents').isDealEvent(event);
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[EventCosts] JSON parse failed:', err.message);
    return fallback;
  }
}

/** The event's live cost rows, oldest first. */
async function listEventCosts(sequelize, eventId, { transaction } = {}) {
  const [rows] = await sequelize.query(
    `SELECT ${COST_COLUMNS} FROM event_costs
      WHERE event_id = :eventId AND deleted_at IS NULL
      ORDER BY created_at ASC, id ASC`,
    { replacements: { eventId }, transaction }
  );
  return (rows || []).map(normalizeCost);
}

/** A row's amount as a number, or null: no amount yet, "Price required" (D13 travel). */
function normalizeCost(r) {
  return { ...r, amount: r.amount == null ? null : (Number(r.amount) || 0) };
}

/**
 * Validates a cost body. `partial` (PUT) allows any subset; POST needs a
 * kind and an amount. The amount may be null: no amount yet, which reads
 * "Price required" and holds Start Episode while Lala pays the line (D13
 * travel, 2026-09-30). Returns { fields } or { error }.
 */
function readCostBody(body, { partial }) {
  const b = body && typeof body === 'object' ? body : {};
  const fields = {};

  if (b.kind !== undefined || !partial) {
    if (!COST_KINDS.includes(b.kind)) return { error: `kind must be one of ${COST_KINDS.join(', ')}` };
    fields.kind = b.kind;
  }
  if (b.label !== undefined) {
    if (b.label === null) fields.label = null;
    else {
      if (typeof b.label !== 'string') return { error: 'label must be a string or null' };
      const label = b.label.trim();
      if (label.length > LABEL_MAX) return { error: `label must be at most ${LABEL_MAX} characters` };
      fields.label = label || null;
    }
  }
  if (b.amount !== undefined || !partial) {
    if (b.amount === null || b.amount === '') {
      fields.amount = null;
    } else {
      const amount = Number(b.amount);
      if (b.amount === undefined || !Number.isInteger(amount) || amount < 0) {
        return { error: 'amount must be a whole number of Prime Coins, 0 or more, or null (price required)' };
      }
      fields.amount = amount;
    }
  }
  if (b.paid_by !== undefined) {
    if (!COST_PAID_BY.includes(b.paid_by)) return { error: `paid_by must be one of ${COST_PAID_BY.join(', ')}` };
    fields.paid_by = b.paid_by;
  }
  return { fields };
}

/** The ledger rows Finalize books for a deal event's costs: Lala's only, with an amount above 0. */
function chargeableCosts(costs) {
  return (costs || []).filter((c) => c.paid_by === 'lala' && (Number(c.amount) || 0) > 0);
}

/**
 * D13 travel: the lines Lala pays that have no amount yet ("Price
 * required"). Start Episode refuses while any remain; a line the host or
 * brand comps needs no price. Returns [{ kind: 'cost', key, label }].
 */
function missingCostPrices(costs) {
  return (costs || [])
    .filter((c) => c.paid_by === 'lala' && c.amount == null)
    .map((c) => ({ kind: 'cost', key: c.id, label: `"${c.label || c.kind}"` }));
}

/** Totals by who pays: { lala, comped }. */
function costTotals(costs) {
  let lala = 0; let comped = 0;
  for (const c of costs || []) {
    const amount = Number(c.amount) || 0;
    if (c.paid_by === 'lala') lala += amount; else comped += amount;
  }
  return { lala, comped };
}

/**
 * Answer 7 and its follow-up (D13 travel, Evoni 2026-09-30): travel and
 * accommodation are drafted only when the event's location is outside
 * Lala's home city (utils/lalaHome.lalaTravelsFor, which reads the show's
 * lala_home setting and the venue's World Location), with the category
 * travel_destination as the fallback. This pure form is the fallback alone,
 * for a caller that has not looked the cities up.
 */
function lalaTravels(event) {
  return event?.category === 'travel_destination';
}

const TRAVEL_SOURCE = 'travel';

/**
 * The terms lines a deal drafts:
 *   - the entry line (self-funded: Lala pays; entry covered: comped by the
 *     host) at cost_coins, when above 0;
 *   - travel and accommodation when Lala travels (`travels`, from
 *     lalaTravelsFor; without it, the category fallback), with no amount:
 *     "Price required", never 0, so the price is set or comped before
 *     Start Episode (Evoni, 2026-09-30). Paid by Lala until Evoni comps
 *     them. Getting around within the home city (rides, valet) is event
 *     spending, not travel.
 * The extras are no longer drafted here: they are event spending, drafted
 * at Start Episode (the event cost split, 2026-09-30).
 * Returns [{ key, kind, label, amount, paid_by, source }].
 */
function draftedCostLines(event, { travels } = {}) {
  const lines = [];
  const entryPayer = entryPayerFor(event);
  const entry = Number(event?.cost_coins) || 0;
  if (entryPayer && entry > 0) {
    lines.push({ key: 'entry', kind: 'entry', label: 'Entry / ticket', amount: entry, paid_by: entryPayer, source: ENTRY_SOURCE });
  }
  if (isDealEvent(event) && (travels === undefined ? lalaTravels(event) : travels)) {
    lines.push({ key: 'travel', kind: 'travel', label: 'Travel', amount: null, paid_by: 'lala', source: TRAVEL_SOURCE });
    lines.push({ key: 'accommodation', kind: 'accommodation', label: 'Accommodation', amount: null, paid_by: 'lala', source: TRAVEL_SOURCE });
  }
  return lines;
}

/**
 * Drafts the deal's cost lines (draftedCostLines), each once: a line
 * already drafted and still live is not drafted again. Runs inside the
 * caller's transaction, after the caller has checked the lock and taken the
 * event row FOR UPDATE. Returns the rows it inserted.
 */
async function draftExtrasCosts(sequelize, eventId, { transaction } = {}) {
  const [eventRows] = await sequelize.query(
    `SELECT id, show_id, deal_type, deal_components, cost_coins, prestige, format, event_type, dress_code, category,
            venue_location_id, canon_consequences
       FROM world_events WHERE id = :eventId FOR UPDATE`,
    { replacements: { eventId }, transaction }
  );
  const event = eventRows?.[0];
  if (!event) return [];

  const cc = parseJson(event.canon_consequences, {}) || {};
  const automation = cc.automation || {};
  const draftedCosts = { ...((automation.drafted_values || {}).costs || {}) };

  const live = await listEventCosts(sequelize, eventId, { transaction });
  const liveIds = new Set(live.map((c) => String(c.id)));
  const liveDraftedKeys = new Set(
    Object.entries(draftedCosts).filter(([id]) => liveIds.has(String(id))).map(([, v]) => v?.key)
  );

  const inserted = [];
  const { lalaTravelsFor } = require('../utils/lalaHome');
  const { travels } = await lalaTravelsFor(sequelize, event, { transaction });
  for (const line of draftedCostLines(event, { travels })) {
    if (liveDraftedKeys.has(line.key)) continue;
    // clock_timestamp, not NOW(): NOW() is fixed for the transaction, and
    // the rows list in the order they were drafted.
    const [rows] = await sequelize.query(
      `INSERT INTO event_costs (id, event_id, kind, label, amount, paid_by, created_at, updated_at)
       VALUES (:id, :eventId, :kind, :label, :amount, :paid_by, clock_timestamp(), clock_timestamp())
       RETURNING ${COST_COLUMNS}`,
      { replacements: { id: uuidv4(), eventId, kind: line.kind, label: line.label, amount: line.amount, paid_by: line.paid_by }, transaction }
    );
    const row = rows?.[0];
    if (row) {
      draftedCosts[row.id] = { key: line.key, amount: line.amount, paid_by: line.paid_by, source: line.source };
      inserted.push(normalizeCost(row));
    }
  }

  if (inserted.length) {
    const nextCc = {
      ...cc,
      automation: {
        ...automation,
        auto_drafted: { ...(automation.auto_drafted || {}), costs: EXTRAS_SOURCE },
        drafted_values: { ...(automation.drafted_values || {}), costs: draftedCosts },
      },
    };
    await sequelize.query(
      'UPDATE world_events SET canon_consequences = :cc, updated_at = NOW() WHERE id = :eventId',
      { replacements: { cc: JSON.stringify(nextCc), eventId }, transaction }
    );
  }
  return inserted;
}

module.exports = {
  COST_KINDS,
  COST_PAID_BY,
  LABEL_MAX,
  EXTRAS_LINES,
  EXTRAS_SOURCE,
  ENTRY_SOURCE,
  ENTRY_PAYER_BY_DEAL,
  TRAVEL_SOURCE,
  entryPayerFor,
  lalaTravels,
  normalizeCost,
  missingCostPrices,
  isDealEvent,
  draftedCostLines,
  listEventCosts,
  readCostBody,
  chargeableCosts,
  costTotals,
  draftExtrasCosts,
};

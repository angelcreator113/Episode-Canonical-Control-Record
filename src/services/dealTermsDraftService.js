'use strict';

/**
 * The whole Terms section, drafted (ruling D13, Evoni 2026-09-30;
 * docs/DEAL_COMPONENTS_DESIGN.md §4, her answers in §8 and §9; build PR 5).
 *
 * When a deal's components are set or changed (the event PUT, before the
 * terms lock), and when Evoni runs Propose terms, draftTerms drafts in one
 * step:
 *   1. Deliverables: D12's sizing by the ticked components
 *      (dealPricingService.sizingFor), in D15's formats.
 *   2. Prices: each component fee and deliverable fee from the rate card
 *      (dealPricingService.proposeTerms).
 *   3. Costs and who covers them: the entry line (answer 3: Lala pays on a
 *      self-funded deal; comped when entry is covered; none on a cash deal
 *      without it); travel and accommodation only when the event's location
 *      is outside Lala's home city (answer 7 and its follow-up; the show's
 *      lala_home setting, utils/lalaHome.lalaTravelsFor; fallback: category
 *      travel_destination), with no amount: "Price required", never 0.
 *      Extras are event spending, never drafted here (the cost split).
 *   4. A suggested bonus, only when partnership_base or performance_fee is
 *      ticked (answer 5): slay 20% and pass 10% of the cash total, rounded
 *      to the nearest 5; no safe bonus.
 *   5. Relationship goals: at most 2 (answer 6), written from the event's
 *      host, brand and guests, stored as automation.relationship_goals
 *      ([{ slot, label, description }]). Start Episode writes them onto the
 *      episode's list as Lala's goals (task_source 'goal', never required),
 *      counted in T9's combined limit.
 *
 * Re-drafting (answer 13): automatic, and only what is still Auto-drafted.
 * A value Evoni edited stays as she left it; one she deleted is not drafted
 * again. Every drafted value is recorded under canon_consequences.automation
 * (doctrine rule 14): auto_drafted.<key> names its source and
 * drafted_values.<key> holds the drafted copy it is compared with.
 *
 * Propose terms (overwritePrices) re-prices every line from the card, as it
 * always has; the automatic draft prices only lines with no price or with
 * the price it drafted.
 */

const { v4: uuidv4 } = require('uuid');
const {
  loadRateCard, lalaPricingTier, proposeTerms, draftDeliverablesForDeal, planFor,
  PRICING_SOURCE, DRAFTED_DELIVERABLES_SOURCE,
} = require('./dealPricingService');
const { listEventDeliverables, insertDeliverableRow } = require('./eventTermsService');
const { listEventCosts, draftedCostLines } = require('./eventCostsService');
const { normalizeBonusTerms } = require('./dealPayoutService');
const { componentsOf } = require('../utils/dealComponents');
const { lalaTravelsFor } = require('../utils/lalaHome');

const DEAL_DRAFT_SOURCE = 'deal';
const RELATIONSHIP_GOALS_MAX = 2;
const BONUS_SHARES = Object.freeze({ slay: 0.2, pass: 0.1 });
const COST_COLUMNS = 'id, event_id, kind, label, amount, paid_by, created_at, updated_at';

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[DealTermsDraft] stored JSON parse failed:', err.message);
    return fallback;
  }
}

const sameJson = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
// A cost amount may be null (no amount yet, "Price required"): null equals only null.
const sameAmount = (a, b) => (a == null ? b == null : b != null && Number(a) === Number(b));
const roundTo5 = (n) => Math.round(Number(n) / 5) * 5;

/** Whether a deliverable row still equals its drafted record (the frontend's deliverableDraftNote). */
function deliverableIsAutoDrafted(row, record) {
  if (!row || !record) return false;
  const sameFee = record.fee == null ? row.fee == null : row.fee != null && Number(record.fee) === Number(row.fee);
  const samePlatform = record.platform === undefined || (record.platform ?? null) === (row.platform ?? null);
  const sameQuantity = record.quantity === undefined || Number(record.quantity) === Number(row.quantity ?? 1);
  return (record.type ?? null) === (row.deliverable_type ?? null)
    && sameFee && samePlatform && sameQuantity
    && (record.description ?? '') === (row.description ?? '')
    && (record.required !== false) === (row.required !== false);
}

/**
 * Answer 5: { slay, pass } of the cash total, rounded to the nearest 5, when
 * partnership_base or performance_fee is ticked; null otherwise or when the
 * cash total is 0. Pure.
 */
function suggestedBonus(keys, cashTotal) {
  const k = Array.isArray(keys) ? keys : [];
  if (!k.includes('partnership_base') && !k.includes('performance_fee')) return null;
  const total = Number(cashTotal) || 0;
  const out = {};
  for (const [tier, share] of Object.entries(BONUS_SHARES)) {
    const amount = roundTo5(total * share);
    if (amount >= 1) out[tier] = amount;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * "Cash total" (INFERRED, design note §9): the fees of the components the
 * deal pays, plus the fees of its paid deliverables. Pure.
 */
function cashTotalOf(event, deliverables = []) {
  const plan = planFor(event);
  if (!plan || !plan.cash) return 0;
  const fields = { appearance: 'appearance_fee', partnership_base: 'partnership_base_fee', performance: 'performance_fee' };
  let total = 0;
  for (const c of plan.components) total += Number(event?.[fields[c]]) || 0;
  if (plan.deliverables) {
    for (const d of deliverables || []) {
      if (d.required !== false) total += Number(d.fee) || 0;
    }
  }
  return total;
}

/**
 * Answer 6: at most 2 relationship goals, written from the event's own
 * fields. Pure. INFERRED wording, from the design note's examples ("Follow
 * up with {host} after the event", "Co-style a moment with {brand}").
 */
function draftRelationshipGoals(event) {
  const automation = parseJson(event?.canon_consequences, {})?.automation || {};
  const host = String(event?.host || '').trim() || null;
  const brand = String(event?.host_brand || automation.host_brand || '').trim() || null;
  const guests = (Array.isArray(automation.guest_profiles) ? automation.guest_profiles : [])
    .map((g) => g?.display_name || g?.handle).filter(Boolean);
  const goals = [];
  if (host) {
    goals.push({ slot: 'relationship_host', label: `Follow up with ${host} after the event`, description: 'A thank-you, and a reason to work together again' });
  }
  if (brand && brand !== host) {
    goals.push({ slot: 'relationship_brand', label: `Co-style a moment with ${brand}`, description: `Something ${brand} would want to share` });
  }
  if (guests.length) {
    goals.push({ slot: 'relationship_guest', label: `Get to know ${guests[0]}`, description: 'One real conversation, and a reason to talk again' });
  }
  return goals.slice(0, RELATIONSHIP_GOALS_MAX);
}

/**
 * Start Episode: the event's relationship goals as Lala's goal tasks
 * (task_source 'goal', never required; T1), at most 2. Pure.
 */
function relationshipGoalTasks(event) {
  const automation = parseJson(event?.canon_consequences, {})?.automation || {};
  const goals = Array.isArray(automation.relationship_goals) ? automation.relationship_goals : [];
  return goals
    .filter((g) => g && String(g.label || '').trim())
    .slice(0, RELATIONSHIP_GOALS_MAX)
    .map((g) => ({
      slot: g.slot || 'relationship',
      label: String(g.label).trim(),
      description: g.description || '',
      timing: 'after',
      platform: 'instagram',
      task_source: 'goal',
      required: false,
      completed: false,
    }));
}

async function insertCost(sequelize, eventId, line, { transaction }) {
  const [rows] = await sequelize.query(
    `INSERT INTO event_costs (id, event_id, kind, label, amount, paid_by, created_at, updated_at)
     VALUES (:id, :eventId, :kind, :label, :amount, :paid_by, clock_timestamp(), clock_timestamp())
     RETURNING ${COST_COLUMNS}`,
    { replacements: { id: uuidv4(), eventId, kind: line.kind, label: line.label, amount: line.amount, paid_by: line.paid_by }, transaction }
  );
  return rows?.[0] || null;
}

/** Thrown when Propose terms cannot price the deal; the route answers 400. */
function proposalError(proposal) {
  const err = new Error(proposal.error);
  err.proposal = proposal;
  err.status = 400;
  return err;
}

/**
 * Drafts the deal's whole Terms section (see the header). Runs inside the
 * caller's transaction; the caller has checked the terms lock.
 *   premiums:        Propose terms' premium choices (proposeTerms)
 *   overwritePrices: Propose terms; re-price every line from the card
 * Returns { skipped } for a legacy event, else { proposal, changes }.
 * With overwritePrices, a proposal that cannot be made throws (status 400).
 */
async function draftTerms(sequelize, eventId, { transaction, premiums = {}, overwritePrices = false } = {}) {
  const [eventRows] = await sequelize.query(
    'SELECT * FROM world_events WHERE id = :eventId AND deleted_at IS NULL FOR UPDATE',
    { replacements: { eventId }, transaction }
  );
  const event = eventRows?.[0];
  if (!event) return { skipped: 'missing' };
  const keys = componentsOf(event);
  if (keys == null) return { skipped: 'legacy' };

  const card = await loadRateCard(sequelize, { transaction });
  // Prices are Lala's: her own career tier, not the event's (Evoni's pricing
  // ruling, 2026-10-01). The event's tier still sizes the job (D12).
  const { tier: priceTier } = await lalaPricingTier(sequelize, event, { transaction });
  const cc = parseJson(event.canon_consequences, {}) || {};
  const automation = cc.automation || {};
  const autoDrafted = { ...(automation.auto_drafted || {}) };
  const draftedValues = { ...(automation.drafted_values || {}) };
  const changes = { deliverables: { added: 0, updated: 0, removed: 0 }, costs: { added: 0, updated: 0, removed: 0 }, fees: 0, bonus: false, goals: false };

  // ── 1. Deliverables ──
  const records = { ...(draftedValues.deliverables || {}) };
  let live = await listEventDeliverables(sequelize, eventId, { transaction });
  const liveIds = new Set(live.map((d) => String(d.id)));
  const declinedTypes = new Set(
    Object.entries(records).filter(([id]) => !liveIds.has(String(id))).map(([, r]) => r?.type).filter(Boolean)
  );
  const isAuto = (row) => deliverableIsAutoDrafted(row, records[row.id]);
  const unmatched = new Set(live.map((d) => d.id));
  // D12's guard stands: deliverables Evoni entered by hand on a deal never
  // drafted are hers; nothing is drafted on top of them.
  const handEntered = live.length > 0 && !automation.auto_drafted?.deliverables;
  const targets = handEntered ? [] : draftDeliverablesForDeal(event, { card, priceTier });
  for (const t of targets) {
    const candidates = live.filter((d) => unmatched.has(d.id) && d.deliverable_type === t.deliverable_type);
    const match = candidates.find(isAuto) || candidates[0];
    if (match) {
      unmatched.delete(match.id);
      if (isAuto(match) && ((match.required !== false) !== (t.required !== false)
        || Number(match.quantity ?? 1) !== Number(t.quantity ?? 1) || (match.platform ?? null) !== (t.platform ?? null)
        || (match.description ?? '') !== (t.description ?? '') || match.owed_to !== t.owed_to)) {
        await sequelize.query(
          `UPDATE event_deliverables SET required = :required, quantity = :quantity, platform = :platform,
              description = :description, owed_to = :owed, updated_at = NOW()
            WHERE id = :id AND deleted_at IS NULL`,
          { replacements: { id: match.id, required: t.required !== false, quantity: t.quantity ?? 1, platform: t.platform ?? null, description: t.description, owed: t.owed_to }, transaction }
        );
        records[match.id] = { ...records[match.id], required: t.required !== false, quantity: t.quantity ?? 1, platform: t.platform ?? null, description: t.description };
        changes.deliverables.updated += 1;
      }
      continue;
    }
    if (declinedTypes.has(t.deliverable_type)) continue;
    const row = await insertDeliverableRow(sequelize, eventId, t, { transaction });
    if (!row) continue;
    records[row.id] = {
      type: t.deliverable_type, platform: t.platform ?? null, quantity: t.quantity ?? 1,
      fee: t.fee ?? null, description: t.description, required: t.required !== false,
    };
    changes.deliverables.added += 1;
    // A row drafted with its price is priced from the card, so the deal
    // records the card's version (the Terms screen read "pricing vnull").
    if (t.fee != null) changes.fees += 1;
  }
  // A drafted row the new components no longer call for goes, unless Evoni edited it.
  for (const d of live) {
    if (handEntered || !unmatched.has(d.id) || !isAuto(d)) continue;
    await sequelize.query(
      'UPDATE event_deliverables SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id AND deleted_at IS NULL',
      { replacements: { id: d.id }, transaction }
    );
    delete records[d.id];
    changes.deliverables.removed += 1;
  }
  if (Object.keys(records).length || autoDrafted.deliverables) {
    autoDrafted.deliverables = DRAFTED_DELIVERABLES_SOURCE;
    draftedValues.deliverables = records;
  }

  // ── 2. Prices ──
  live = await listEventDeliverables(sequelize, eventId, { transaction });
  const proposal = proposeTerms({ event, deliverables: live, premiums, card, tier: priceTier });
  const feeWrites = {};
  if (!proposal.ok) {
    if (overwritePrices) throw proposalError(proposal);
    console.warn(`[DealTermsDraft] event ${eventId}: not priced (${proposal.error})`);
  } else {
    for (const c of Object.values(proposal.components)) {
      if (c.fee == null) continue;
      const current = event[c.field];
      const auto = current == null || (draftedValues[c.field] != null && Number(current) === Number(draftedValues[c.field]));
      if (!overwritePrices && !auto) continue;
      feeWrites[c.field] = c.fee;
      event[c.field] = c.fee;
      autoDrafted[c.field] = PRICING_SOURCE;
      draftedValues[c.field] = c.fee;
      changes.fees += 1;
    }
    const draftedFees = { ...(draftedValues.deliverable_fees || {}) };
    for (const line of proposal.deliverables) {
      if (line.fee == null) continue;
      const row = live.find((d) => d.id === line.id);
      if (!row) continue;
      const wasAuto = deliverableIsAutoDrafted(row, records[row.id]);
      const auto = row.fee == null || wasAuto
        || (draftedFees[row.id] != null && Number(row.fee) === Number(draftedFees[row.id]));
      if (!overwritePrices && !auto) continue;
      if (Number(row.fee) !== Number(line.fee) || row.fee == null) {
        await sequelize.query(
          'UPDATE event_deliverables SET fee = :fee, updated_at = NOW() WHERE id = :id AND deleted_at IS NULL',
          { replacements: { id: row.id, fee: line.fee }, transaction }
        );
        row.fee = line.fee;
        changes.fees += 1;
      }
      draftedFees[row.id] = line.fee;
      if (wasAuto) records[row.id] = { ...records[row.id], fee: line.fee };
    }
    if (Object.keys(draftedFees).length) {
      autoDrafted.deliverable_fees = PRICING_SOURCE;
      draftedValues.deliverable_fees = draftedFees;
    }
    if (Object.keys(records).length) draftedValues.deliverables = records;
  }

  // ── 3. Costs ──
  const costRecords = { ...(draftedValues.costs || {}) };
  const costs = await listEventCosts(sequelize, eventId, { transaction });
  const costById = new Map(costs.map((c) => [String(c.id), c]));
  const { travels } = await lalaTravelsFor(sequelize, event, { transaction });
  const wanted = new Map(draftedCostLines(event, { travels }).map((l) => [l.key, l]));
  const liveKeys = new Set();
  const declinedKeys = new Set();
  for (const [id, record] of Object.entries(costRecords)) {
    const key = record?.key;
    if (!key || key === 'drinks' || key === 'valet' || key === 'photo_booth') continue; // pre-split extras
    const row = costById.get(String(id));
    if (!row) { declinedKeys.add(key); continue; }
    const autoCost = sameAmount(row.amount, record.amount)
      && (record.paid_by === undefined || record.paid_by === row.paid_by);
    const want = wanted.get(key);
    if (autoCost && !want) {
      await sequelize.query('UPDATE event_costs SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id', { replacements: { id: row.id }, transaction });
      delete costRecords[id];
      changes.costs.removed += 1;
      continue;
    }
    liveKeys.add(key);
    if (autoCost && want && (want.paid_by !== row.paid_by || !sameAmount(want.amount, row.amount))) {
      await sequelize.query('UPDATE event_costs SET paid_by = :paidBy, amount = :amount, updated_at = NOW() WHERE id = :id',
        { replacements: { id: row.id, paidBy: want.paid_by, amount: want.amount }, transaction });
      costRecords[id] = { ...record, amount: want.amount, paid_by: want.paid_by };
      changes.costs.updated += 1;
    }
  }
  for (const [key, line] of wanted) {
    if (liveKeys.has(key) || declinedKeys.has(key)) continue;
    const row = await insertCost(sequelize, eventId, line, { transaction });
    if (!row) continue;
    costRecords[row.id] = { key, amount: line.amount, paid_by: line.paid_by, source: line.source };
    changes.costs.added += 1;
  }
  if (changes.costs.added || changes.costs.removed || changes.costs.updated || draftedValues.costs) {
    if (changes.costs.added) autoDrafted.costs = autoDrafted.costs || DEAL_DRAFT_SOURCE;
    draftedValues.costs = costRecords;
  }

  // ── 4. Suggested bonus ──
  const currentBonus = normalizeBonusTerms(event.bonus_terms).value;
  const draftedBonus = draftedValues.bonus_terms;
  const bonusDeclined = draftedBonus != null && currentBonus == null;
  const bonusAuto = sameJson(currentBonus, draftedBonus) || (currentBonus == null && !bonusDeclined);
  let bonusWrite;
  if (bonusAuto) {
    const suggestion = suggestedBonus(keys, cashTotalOf(event, live));
    if (!sameJson(suggestion, currentBonus)) {
      bonusWrite = suggestion;
      changes.bonus = true;
    }
    if (suggestion != null || draftedBonus !== undefined) {
      autoDrafted.bonus_terms = DEAL_DRAFT_SOURCE;
      draftedValues.bonus_terms = suggestion;
    }
  }

  // ── 5. Relationship goals ──
  const nextAutomation = { ...automation };
  const currentGoals = automation.relationship_goals;
  if (currentGoals === undefined || sameJson(currentGoals, draftedValues.relationship_goals)) {
    const goals = draftRelationshipGoals(event);
    if (!sameJson(goals, currentGoals)) changes.goals = true;
    nextAutomation.relationship_goals = goals;
    autoDrafted.relationship_goals = DEAL_DRAFT_SOURCE;
    draftedValues.relationship_goals = goals;
  }

  const nextCc = {
    ...cc,
    automation: {
      ...nextAutomation,
      auto_drafted: autoDrafted,
      drafted_values: draftedValues,
      ...(proposal.ok && changes.fees ? { pricing_version: proposal.pricing_version } : {}),
    },
  };
  const sets = ['canon_consequences = :cc', 'updated_at = NOW()'];
  const replacements = { cc: JSON.stringify(nextCc), eventId };
  // Field names come from EVENT_COMPONENTS (proposeTerms), never from a request.
  for (const [field, fee] of Object.entries(feeWrites)) {
    sets.push(`${field} = :${field}`);
    replacements[field] = fee;
  }
  if (proposal.ok && (overwritePrices || Object.keys(feeWrites).length || changes.fees)) {
    sets.push('pricing_version = :version');
    replacements.version = proposal.pricing_version;
  }
  if (bonusWrite !== undefined) {
    sets.push('bonus_terms = :bonus');
    replacements.bonus = bonusWrite == null ? null : JSON.stringify(bonusWrite);
  }
  await sequelize.query(`UPDATE world_events SET ${sets.join(', ')} WHERE id = :eventId`, { replacements, transaction });

  return { proposal, changes };
}

/**
 * draftTerms in its own transaction, after the components changed (the
 * event PUT, or a drafted deal type). Skipped while the terms are locked.
 * Never throws: a failure is logged, so the save that triggered it stands.
 */
async function syncDraftedTerms(sequelize, eventId) {
  if (!sequelize || typeof sequelize.transaction !== 'function' || !eventId) return { skipped: 'no_event' };
  try {
    const { findTermsWriteLock } = require('../utils/eventTermsLock');
    return await sequelize.transaction(async (transaction) => {
      if (await findTermsWriteLock(sequelize, eventId, { transaction })) return { skipped: 'locked' };
      return draftTerms(sequelize, eventId, { transaction });
    });
  } catch (err) {
    console.error(`[DealTermsDraft] draft for event ${eventId} failed:`, err.message);
    return { skipped: 'error' };
  }
}

module.exports = {
  DEAL_DRAFT_SOURCE,
  RELATIONSHIP_GOALS_MAX,
  BONUS_SHARES,
  deliverableIsAutoDrafted,
  suggestedBonus,
  cashTotalOf,
  draftRelationshipGoals,
  relationshipGoalTasks,
  draftTerms,
  syncDraftedTerms,
};

'use strict';

/**
 * Episode Money, Phase B: the episode's money lines and their states
 * (Evoni's rulings MB1–MB3 and answers, 2026-10-01;
 * docs/EVENT_EPISODE_FLOW.md §8(gg); docs/EPISODE_MONEY_PHASE_B_NOTE.md).
 * Pure: the caller loads the event, its costs and deliverables, the
 * episode's spending lines and its counted ledger rows.
 *
 *   MB1. Every money line shows one state: Planned (its trigger not yet
 *   reached), Pending (its trigger reached but not yet posted), or Posted
 *   (a ledger row exists, linked by its source).
 *   MB2. Each line shows its trigger, who pays or covers it, and its
 *   amount. Planned and Pending never enter the ledger or the balance (M2).
 *   MB3. The projected net (posted + pending + planned) and Lala's
 *   projected balance after the episode, beside her actual balance.
 *
 * Answers (note §3, §4):
 *   Q1. The lines: deal components, each bonus tier, content fees, terms
 *       costs Lala pays, the entry cost, a legacy event's payment, content
 *       revenue and styling extras, and event spending; a posted row no
 *       line matches is "Posted, not planned". Wardrobe was Phase C; since
 *       2026-10-06 Lala's look is planned too, a line per piece Finalize
 *       charges (episodeLookCharges), triggered at Finalize.
 *   Q2. A line matches its row by ledger category and source id.
 *   Q3. Each bonus tier is its own line; no conditional bonus is counted
 *       in the projection: it is shown as "+ up to X if SLAY" beside it.
 *   Q4. A content fee is Pending while its deliverable is submitted;
 *       Complete's lines post in Complete's transaction, so they are never
 *       Pending.
 *   Q5. The projected balance counts this episode's lines only.
 *   Q8. A cost the host or brand comps is listed as covered, at 0 to Lala,
 *       outside the totals.
 *   Q9. A content fee approved after Complete stays Pending until it posts.
 */

const STATES = Object.freeze({
  PLANNED: 'planned',
  PENDING: 'pending',
  POSTED: 'posted',
  // After Complete, a bonus tier that was not reached (no row was booked).
  NOT_EARNED: 'not_earned',
  // A cost the host or brand comps: never charged to Lala (Law 6).
  COVERED: 'covered',
});

const TRIGGERS = Object.freeze({
  COMPLETE: 'at Complete',
  APPROVAL: 'on approval',
  // Complete's Finalize step, which charges Lala's look.
  FINALIZE: 'at Finalize',
});

const COMPONENT_LABELS = Object.freeze({
  appearance_fee: 'Appearance fee',
  partnership_base_fee: 'Partnership base',
  performance_fee: 'Performance fee',
});

const whole = (n) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v) : 0;
};

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[EpisodeMoneyLines] JSON parse failed:', err.message);
    return fallback;
  }
}

const rowKey = (category, sourceId) => `${category}|${sourceId}`;

/** Who pays a line that comes from the host or brand (dealPayoutService.payerFor's rule). */
function hostOrBrand(event, { brandFirst = true } = {}) {
  if (brandFirst && event?.host_brand) return { who: 'brand', name: event.host_brand };
  return { who: 'host', name: event?.host || null };
}

const LALA = Object.freeze({ who: 'lala', name: 'Lala' });

/**
 * The plan: every line the accepted terms and the spending lines make,
 * before any is matched to the ledger.
 */
function plannedLines({ event, costs = [], deliverables = [], spending = [], hadSpending = false, look = [] }) {
  if (!event) return [];
  const { normalizePaidFreeFlags } = require('./financialTransactionService');
  const { completionPayouts, contentFeeFor, normalizeBonusTerms, BONUS_TIERS } = require('./dealPayoutService');
  const { planFor } = require('./dealPricingService');
  const { isPaid, isDeal, eventCost, eventPayment } = normalizePaidFreeFlags(event);
  const lines = [];
  const add = (line) => lines.push({ conditional: false, covered: false, ...line });

  // Deal components, paid at Complete (deal build PR 5).
  for (const p of completionPayouts(event, null)) {
    add({
      key: rowKey(p.category, event.id),
      kind: 'income',
      category: p.category,
      label: COMPONENT_LABELS[p.category] || p.category,
      amount: whole(p.amount),
      trigger: TRIGGERS.COMPLETE,
      payer: { who: p.metadata?.payer || 'host', name: p.metadata?.payer_name || null },
      source: { type: 'event', id: event.id },
    });
  }

  // Each bonus tier the accepted deal names (Q3): conditional, its own line.
  const plan = planFor(event);
  if (plan && plan.cash) {
    const bonus = normalizeBonusTerms(event.bonus_terms).value || {};
    for (const tier of BONUS_TIERS) {
      const amount = whole(bonus[tier]);
      if (amount <= 0) continue;
      add({
        key: `deal_bonus|${event.id}|${tier}`,
        kind: 'income',
        category: 'deal_bonus',
        label: `Bonus (${tier.toUpperCase()})`,
        amount,
        trigger: `if ${tier.toUpperCase()}`,
        tier,
        conditional: true,
        payer: hostOrBrand(event),
        source: { type: 'event', id: event.id },
      });
    }
  }

  // Each deliverable's content fee, paid on approval.
  for (const d of deliverables) {
    const fee = whole(contentFeeFor(event, d));
    if (fee <= 0) continue;
    const owedTo = d.owed_to === 'brand' ? 'brand' : 'host';
    add({
      key: rowKey('content_fee', d.id),
      kind: 'income',
      category: 'content_fee',
      label: `Content fee: ${d.description || 'deliverable'}`,
      amount: fee,
      trigger: TRIGGERS.APPROVAL,
      payer: { who: owedTo, name: owedTo === 'brand' ? (event.host_brand || null) : (event.host || null) },
      source: { type: 'deliverable', id: d.id },
      deliverable_status: d.status || 'pending',
    });
  }

  // A legacy event's payment and, for a brand deal, its content revenue.
  if (isPaid && eventPayment > 0) {
    add({
      key: rowKey('event_payment', event.id),
      kind: 'income',
      category: 'event_payment',
      label: 'Event payment',
      amount: whole(eventPayment),
      trigger: TRIGGERS.COMPLETE,
      payer: hostOrBrand(event, { brandFirst: false }),
      source: { type: 'event', id: event.id },
    });
    if (event.event_type === 'brand_deal') {
      const revenue = Math.round(eventPayment * 0.1);
      if (revenue > 0) {
        add({
          key: rowKey('content_revenue', event.id),
          kind: 'income',
          category: 'content_revenue',
          label: 'Brand deal content fee',
          amount: revenue,
          trigger: TRIGGERS.COMPLETE,
          payer: hostOrBrand(event),
          source: { type: 'event', id: event.id },
        });
      }
    }
  }

  // The entry cost (a legacy or self-funded event; a deal event has none).
  if (eventCost > 0) {
    add({
      key: rowKey('event_entry', event.id),
      kind: 'expense',
      category: 'event_entry',
      label: 'Entry cost',
      amount: whole(eventCost),
      trigger: TRIGGERS.COMPLETE,
      payer: LALA,
      source: { type: 'event', id: event.id },
    });
  }

  // A deal event's itemised terms costs: Lala's are charged at Complete; a
  // comped one is listed as covered, at 0 to Lala (Q8).
  if (isDeal) {
    for (const cost of costs) {
      const amount = cost.amount == null ? null : whole(cost.amount);
      if (cost.paid_by === 'lala') {
        if (!amount || amount <= 0) continue;
        add({
          key: rowKey('event_cost', cost.id),
          kind: 'expense',
          category: 'event_cost',
          label: cost.label || cost.kind,
          amount,
          trigger: TRIGGERS.COMPLETE,
          payer: LALA,
          source: { type: 'event_cost', id: cost.id },
        });
      } else if (cost.paid_by === 'host' || cost.paid_by === 'brand') {
        add({
          key: `covered|${cost.id}`,
          kind: 'expense',
          category: 'event_cost',
          label: cost.label || cost.kind,
          amount: 0,
          covered_amount: amount,
          covered: true,
          trigger: null,
          payer: cost.paid_by === 'brand' ? { who: 'brand', name: event.host_brand || null } : { who: 'host', name: event.host || null },
          source: { type: 'event_cost', id: cost.id },
        });
      }
    }
  }

  // Event spending, charged at Complete.
  for (const line of spending) {
    const total = whole(line.total);
    if (total <= 0) continue;
    add({
      key: rowKey('event_spending', line.id),
      kind: 'expense',
      category: 'event_spending',
      label: line.quantity > 1 ? `${line.label} × ${line.quantity}` : line.label,
      amount: total,
      trigger: TRIGGERS.COMPLETE,
      payer: LALA,
      source: { type: 'event_spending', id: line.id },
      // MB6 (Q7): a spending line's change from its draft is shown in the
      // reconciliation.
      quantity: line.quantity,
      unit_price: line.unit_price,
      drafted: line.drafted_quantity == null || line.drafted_unit_price == null
        ? null : { quantity: line.drafted_quantity, unit_price: line.drafted_unit_price },
    });
  }

  // A legacy event's styling extras, charged only when the episode never
  // had spending lines (finalizeEpisodeFinancials step 8b).
  if (!isDeal && !hadSpending) {
    const { eventExtrasFor } = require('../utils/financialRates');
    const { drinks = 0, valet = 0, photo_booth: photoBooth = 0 } = eventExtrasFor(event) || {};
    const extras = whole(drinks + valet + photoBooth);
    if (extras > 0) {
      add({
        key: rowKey('styling_extras', event.id),
        kind: 'expense',
        category: 'styling_extras',
        label: 'Styling, transport & extras',
        amount: extras,
        trigger: TRIGGERS.COMPLETE,
        payer: LALA,
        source: { type: 'event', id: event.id },
      });
    }
  }

  // Lala's look (Evoni, 2026-10-06): each piece Finalize charges, from
  // episodeLookCharges, so the estimate is what Finalize books; a piece
  // already paid for in this episode is its posted row.
  for (const { category, piece, amount } of look) {
    const total = whole(amount);
    if (total <= 0 || piece?.id == null) continue;
    add({
      key: rowKey(category, piece.id),
      kind: 'expense',
      category,
      label: category === 'wardrobe_rental' ? `Rental: ${piece.name}` : piece.name,
      amount: total,
      trigger: TRIGGERS.FINALIZE,
      payer: LALA,
      source: { type: 'wardrobe', id: piece.id },
      look: true,
    });
  }

  return lines;
}

/**
 * Matches the plan to the episode's counted ledger rows and gives each
 * line its state. Returns { lines, unplanned, projection }.
 *
 * rows: the episode's counted rows, each { id, category, source_id,
 * metadata, amount, signed }. balance: Lala's actual balance.
 * completed: the episode's evaluation is accepted.
 */
function buildMoneyLines({ plan, rows = [], balance = 0, completed = false }) {
  const byKey = new Map();
  const bonusRows = [];
  for (const r of rows) {
    if (r.category === 'deal_bonus') { bonusRows.push(r); continue; }
    if (r.source_id != null) byKey.set(rowKey(r.category, r.source_id), r);
  }
  const used = new Set();

  const lines = plan.map((line) => {
    let row = null;
    if (line.category === 'deal_bonus') {
      row = bonusRows.find((r) => !used.has(r.id)
        && String(r.source_id) === String(line.source.id)
        && String(parseJson(r.metadata, {})?.tier || '').toLowerCase() === line.tier) || null;
    } else if (!line.covered) {
      row = byKey.get(line.key) || null;
      if (row && used.has(row.id)) row = null;
    }
    if (row) used.add(row.id);

    let state;
    if (line.covered) state = STATES.COVERED;
    else if (row) state = STATES.POSTED;
    else if (line.conditional) state = completed ? STATES.NOT_EARNED : STATES.PLANNED;
    else if (line.category === 'content_fee' && line.deliverable_status === 'submitted') state = STATES.PENDING;
    else state = STATES.PLANNED;

    const signed = line.kind === 'income' ? line.amount : -line.amount;
    return {
      ...line,
      state,
      signed,
      posted: row ? { id: row.id, amount: row.amount, signed: row.signed } : null,
    };
  });

  // Posted rows no line matches (wardrobe, milestones, or a row written
  // before the plan changed): shown as "Posted, not planned" (Q1).
  const unplanned = rows.filter((r) => !used.has(r.id)).map((r) => ({ ...r, state: STATES.POSTED, planned: false }));

  const sum = (ls) => ls.reduce((s, l) => s + l.signed, 0);
  const counted = lines.filter((l) => !l.conditional && !l.covered);
  const pendingNet = sum(counted.filter((l) => l.state === STATES.PENDING));
  const plannedNet = sum(counted.filter((l) => l.state === STATES.PLANNED));
  const postedNet = rows.reduce((s, r) => s + (Number(r.signed) || 0), 0);

  return {
    lines,
    unplanned,
    projection: {
      posted_net: postedNet,
      pending_net: pendingNet,
      planned_net: plannedNet,
      projected_net: postedNet + pendingNet + plannedNet,
      actual_balance: balance,
      projected_balance: balance + pendingNet + plannedNet,
      // Q3: never counted; shown as "+ up to X if SLAY" beside the net.
      conditional: lines
        .filter((l) => l.conditional && l.state === STATES.PLANNED)
        .map((l) => ({ tier: l.tier, amount: l.amount, label: l.label })),
      open_count: lines.filter((l) => l.state === STATES.PLANNED || l.state === STATES.PENDING).length,
    },
  };
}

const WARNING_CODES = Object.freeze({
  PROJECTED_BELOW_ZERO: 'PROJECTED_BELOW_ZERO',
  COSTS_EXCEED_BALANCE: 'COSTS_EXCEED_BALANCE',
});

/**
 * MB4's early warnings (Q6, accepted as recommended): warn when either goes
 * below zero, with the shortfall:
 *   (a) the projected balance after the episode (MB3);
 *   (b) Lala's actual balance minus this episode's open costs and spending,
 *       without its income ("if the income does not arrive"). Event
 *       spending is named when it alone exceeds what she has.
 * Warnings never block; Complete's refusals stay as they are.
 * Returns [] or [{ code, shortfall, message, ... }].
 */
function moneyWarnings({ lines = [], projection, balance = 0 }) {
  const warnings = [];
  const open = lines.filter((l) => !l.covered && !l.conditional
    && (l.state === STATES.PLANNED || l.state === STATES.PENDING) && l.kind === 'expense');
  const openCosts = open.reduce((s, l) => s + l.amount, 0);
  const openSpending = open.filter((l) => l.category === 'event_spending').reduce((s, l) => s + l.amount, 0);

  if (projection && projection.projected_balance < 0) {
    const shortfall = -projection.projected_balance;
    warnings.push({
      code: WARNING_CODES.PROJECTED_BELOW_ZERO,
      shortfall,
      projected_balance: projection.projected_balance,
      message: `After this episode Lala's balance is projected at ${projection.projected_balance}: ${shortfall} short.`,
    });
  }
  if (openCosts > 0 && balance - openCosts < 0) {
    const shortfall = openCosts - balance;
    const spendingAlone = openSpending > balance;
    warnings.push({
      code: WARNING_CODES.COSTS_EXCEED_BALANCE,
      shortfall,
      costs: openCosts,
      spending: openSpending,
      have: balance,
      spending_alone: spendingAlone,
      message: spendingAlone
        ? `Event spending (${openSpending}) is more than Lala has (${balance}): ${openSpending - balance} short before any income arrives.`
        : `This episode's costs and spending (${openCosts}) are more than Lala has (${balance}): ${shortfall} short if the income does not arrive.`,
    });
  }
  return warnings;
}

// ─── MB6: the plan at Start Episode, and the reconciliation after Complete ───

const PLAN_FIELDS = ['key', 'kind', 'category', 'label', 'amount', 'trigger', 'payer', 'conditional',
  'covered', 'covered_amount', 'tier', 'state', 'source', 'quantity', 'unit_price', 'drafted', 'look'];

/** The plan saved on the episode at Start Episode (Q7): its lines as they stand, nothing posted yet. */
function planSnapshot({ lines = [], balance = 0, takenAt = new Date() }) {
  return {
    taken_at: takenAt instanceof Date ? takenAt.toISOString() : takenAt,
    balance,
    lines: lines.map((l) => PLAN_FIELDS.reduce((o, f) => {
      if (l[f] !== undefined) o[f] = l[f];
      return o;
    }, {})),
  };
}

const RECON = Object.freeze({
  AS_PLANNED: 'as_planned',
  CHANGED: 'changed',
  NOT_EARNED: 'not_earned',
  EARNED: 'earned',
  OUTSTANDING: 'outstanding',
  ADDED: 'added',
  REMOVED: 'removed',
  COVERED: 'covered',
  UNPLANNED: 'unplanned',
});

const signedOf = (kind, amount) => (kind === 'income' ? amount : -amount);

/**
 * MB6 (Q7, accepted): per line, the plan saved at Start Episode beside what
 * posted, marking a bonus not earned, a line changed, added or removed, and
 * a fee still outstanding; a spending line also shows its change from its
 * draft. Pure.
 *
 * plan: the saved snapshot's lines (or, with no snapshot, the lines as they
 * stand: `basis` says which). lines: the current lines from buildMoneyLines.
 * unplanned: posted rows no line matches.
 * Returns { rows, totals, highlighted }.
 */
function reconcile({ plan = [], lines = [], unplanned = [] }) {
  const current = new Map(lines.map((l) => [l.key, l]));
  const seen = new Set();
  const rows = [];

  for (const p of plan) {
    seen.add(p.key);
    const now = current.get(p.key) || null;
    const planned = p.covered ? 0 : signedOf(p.kind, p.amount);
    const posted = now?.posted ? now.posted.signed : null;
    let status;
    if (p.covered) status = RECON.COVERED;
    else if (p.conditional) status = now?.state === STATES.POSTED ? RECON.EARNED : RECON.NOT_EARNED;
    else if (posted != null) status = posted === planned ? RECON.AS_PLANNED : RECON.CHANGED;
    else if (now && (now.state === STATES.PLANNED || now.state === STATES.PENDING)) status = RECON.OUTSTANDING;
    else status = RECON.REMOVED;

    const row = {
      key: p.key,
      label: now?.label || p.label,
      category: p.category,
      kind: p.kind,
      conditional: Boolean(p.conditional),
      planned: p.conditional ? 0 : planned,
      planned_conditional: p.conditional ? signedOf(p.kind, p.amount) : null,
      posted,
      difference: posted == null || p.covered || p.conditional ? null : posted - planned,
      status,
    };
    if (now && now.state === STATES.PENDING) row.pending = true;
    // A spending line: its change from its draft (Q7).
    const draft = p.drafted || now?.drafted || null;
    const quantity = now?.quantity ?? p.quantity;
    const unitPrice = now?.unit_price ?? p.unit_price;
    if (p.category === 'event_spending' && draft && (draft.quantity !== quantity || draft.unit_price !== unitPrice)) {
      row.draft_change = { from: draft, to: { quantity, unit_price: unitPrice } };
    }
    rows.push(row);
  }

  // Lines that were not in the plan: added after Start Episode.
  for (const l of lines) {
    if (seen.has(l.key) || l.covered) continue;
    rows.push({
      key: l.key,
      label: l.label,
      category: l.category,
      kind: l.kind,
      conditional: Boolean(l.conditional),
      planned: 0,
      planned_conditional: null,
      posted: l.posted ? l.posted.signed : null,
      difference: l.posted ? l.posted.signed : null,
      status: l.conditional && l.state !== STATES.POSTED ? RECON.NOT_EARNED : RECON.ADDED,
      ...(l.state === STATES.PENDING ? { pending: true } : {}),
    });
  }

  // Posted rows no line matches (wardrobe, milestones): posted, not planned.
  for (const r of unplanned) {
    rows.push({
      key: `row|${r.id}`,
      label: r.description || String(r.category || '').replace(/_/g, ' '),
      category: r.category,
      kind: Number(r.signed) >= 0 ? 'income' : 'expense',
      conditional: false,
      planned: 0,
      planned_conditional: null,
      posted: Number(r.signed) || 0,
      difference: Number(r.signed) || 0,
      status: RECON.UNPLANNED,
    });
  }

  const sum = (key) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
  const plannedNet = sum('planned');
  const postedNet = sum('posted');
  const quiet = new Set([RECON.AS_PLANNED, RECON.COVERED, RECON.EARNED]);
  return {
    rows,
    totals: { planned_net: plannedNet, posted_net: postedNet, difference: postedNet - plannedNet },
    highlighted: rows.filter((r) => !quiet.has(r.status) || r.draft_change).length,
  };
}

module.exports = {
  STATES, TRIGGERS, WARNING_CODES, RECON,
  plannedLines, buildMoneyLines, moneyWarnings, planSnapshot, reconcile,
};

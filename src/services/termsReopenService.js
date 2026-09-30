'use strict';

/**
 * Reopen terms (Evoni's ruling, docs/EVENT_EPISODE_FLOW.md §8(cc),
 * 2026-09-30; Task #2378):
 *
 *   "An event's locked terms can be reopened by Evoni only while its episode
 *   is a draft, has no ledger rows except wardrobe purchases, and every
 *   deliverable is still pending; with confirmation; saving relocks and
 *   records the reopen in the event's history. The brief's terms snapshot,
 *   deliverable stamping, deliverable tasks, estimated money and the
 *   affordability warning rebuild automatically on save. Invitation and
 *   script regeneration are offered, not forced, with a reminder when the
 *   terms mention money."
 *
 * reopenEligibility  the ruling's test, with a reason for each rule that fails.
 * reopenTerms        sets canon_consequences.terms_reopen on the event (the
 *                    marker findTermsWriteLock reads, so every term-writing
 *                    route lifts its lock) and records 'terms_reopened' in
 *                    canon_consequences.terms_history.
 * relockTerms        "Save and relock": clears the marker, records
 *                    'terms_relocked' with the fields that changed, and
 *                    rebuilds what Start Episode built from the terms, with
 *                    Start Episode's own functions (planTermsRebuild).
 *
 * Both writes lock the episode row and then the event row, the order
 * Complete keeps (episode, then event), and re-check under those locks.
 */

const {
  findTermsLockEpisode, reopenMarkerOf, changedLockedFields, stable,
  LOCKED_EVENT_FIELDS, TERMS_REOPEN_KEY, TERMS_HISTORY_KEY,
} = require('../utils/eventTermsLock');
const { NOT_WARDROBE_SPEND_ROW } = require('./financialTransactionService');
const { listEventDeliverables, stampDeliverablesEpisode, buildTermsSnapshot } = require('./eventTermsService');
const { listEventCosts } = require('./eventCostsService');
const {
  calculateFinancials, computeAffordabilityWarning, loadFinancialWardrobeItems,
} = require('./episodeGeneratorService');
const { withDeliverableTasks } = require('../utils/socialTaskSource');
const { describeInvitationMoney } = require('./invitationCompositingService');

const REOPEN_REASONS = {
  NOT_LOCKED: 'NOT_LOCKED',
  EPISODE_NOT_DRAFT: 'EPISODE_NOT_DRAFT',
  LEDGER_ROWS: 'LEDGER_ROWS',
  DELIVERABLES_NOT_PENDING: 'DELIVERABLES_NOT_PENDING',
};

const CODES = {
  CONFIRM_REQUIRED: 'TERMS_REOPEN_CONFIRM_REQUIRED',
  NOT_ELIGIBLE: 'TERMS_REOPEN_NOT_ELIGIBLE',
  ALREADY_REOPENED: 'TERMS_ALREADY_REOPENED',
  NOT_REOPENED: 'TERMS_NOT_REOPENED',
};

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The ruling's test, pure. Each rule that fails gives one reason
 * { code, message }; eligible when there are none.
 *   lockEpisode             the episode that locks the terms, or null
 *   episodeStatus           episodes.status
 *   ledgerRows              the episode's live ledger rows that are not
 *                           wardrobe purchases (NOT_WARDROBE_SPEND_ROW)
 *   nonPendingDeliverables  the event's live deliverables not 'pending'
 */
function eligibilityReasons({ lockEpisode, episodeStatus, ledgerRows = 0, nonPendingDeliverables = 0 }) {
  if (!lockEpisode) {
    return [{ code: REOPEN_REASONS.NOT_LOCKED, message: 'These terms are not locked; edit them directly.' }];
  }
  const reasons = [];
  const status = episodeStatus || 'draft';
  if (status !== 'draft') {
    reasons.push({ code: REOPEN_REASONS.EPISODE_NOT_DRAFT, message: `The episode is ${status}, not a draft.` });
  }
  if (ledgerRows > 0) {
    reasons.push({
      code: REOPEN_REASONS.LEDGER_ROWS,
      message: `The episode has ${plural(ledgerRows, 'ledger row', 'ledger rows')} besides wardrobe purchases.`,
    });
  }
  if (nonPendingDeliverables > 0) {
    reasons.push({
      code: REOPEN_REASONS.DELIVERABLES_NOT_PENDING,
      message: `${plural(nonPendingDeliverables, 'deliverable has', 'deliverables have')} moved past pending.`,
    });
  }
  return reasons;
}

async function countOne(sequelize, sql, replacements, transaction) {
  const [rows] = await sequelize.query(sql, { replacements, transaction });
  return parseInt(rows?.[0]?.cnt, 10) || 0;
}

/**
 * Reads what the test needs and applies it. Returns
 * { eligible, reasons, episode, reopened } where reopened is the open
 * marker (or null). Called inside the write transactions after the rows are
 * locked, and on its own for the Event Package's button.
 */
async function reopenEligibility(sequelize, eventId, { transaction, lockEpisode: knownLock } = {}) {
  const lockEpisode = knownLock !== undefined ? knownLock : await findTermsLockEpisode(sequelize, eventId, { transaction });
  const [eventRows] = await sequelize.query(
    'SELECT canon_consequences FROM world_events WHERE id = :eventId AND deleted_at IS NULL LIMIT 1',
    { replacements: { eventId }, transaction }
  );
  const reopened = reopenMarkerOf(eventRows?.[0]?.canon_consequences);
  if (!lockEpisode) {
    return { eligible: false, reasons: eligibilityReasons({ lockEpisode: null }), episode: null, reopened };
  }

  const [episodeRows] = await sequelize.query(
    'SELECT status FROM episodes WHERE id = :episodeId LIMIT 1',
    { replacements: { episodeId: lockEpisode.id }, transaction }
  );
  const ledgerRows = await countOne(sequelize,
    `SELECT COUNT(*) AS cnt FROM financial_transactions
      WHERE episode_id = :episodeId AND deleted_at IS NULL AND ${NOT_WARDROBE_SPEND_ROW}`,
    { episodeId: lockEpisode.id }, transaction);
  const nonPendingDeliverables = await countOne(sequelize,
    `SELECT COUNT(*) AS cnt FROM event_deliverables
      WHERE event_id = :eventId AND deleted_at IS NULL AND COALESCE(status, 'pending') <> 'pending'`,
    { eventId }, transaction);

  const reasons = eligibilityReasons({
    lockEpisode, episodeStatus: episodeRows?.[0]?.status, ledgerRows, nonPendingDeliverables,
  });
  return {
    eligible: reasons.length === 0,
    reasons,
    episode: {
      id: lockEpisode.id,
      title: lockEpisode.title ?? null,
      episode_number: lockEpisode.episode_number ?? null,
      status: episodeRows?.[0]?.status ?? null,
    },
    reopened,
  };
}

// The terms as a person reads them, reduced for comparison: each locked
// world_events field as stored, the deliverables and the itemised costs.
function deliverableTerms(deliverables) {
  return (deliverables || []).map((d) => ({
    id: d.id, description: d.description ?? null, deliverable_type: d.deliverable_type ?? null,
    // D15 (2026-09-30): the format's platform and quantity.
    platform: d.platform ?? null, quantity: d.quantity == null ? 1 : Number(d.quantity),
    due_date: d.due_date ?? null, required: d.required !== false, owed_to: d.owed_to || 'host',
    fee: d.fee == null ? null : Number(d.fee),
  }));
}

function costTerms(costs) {
  return (costs || []).map((c) => ({
    id: c.id, kind: c.kind ?? null, label: c.label ?? null, amount: Number(c.amount) || 0, paid_by: c.paid_by ?? null,
  }));
}

function termsState(event, deliverables, costs) {
  const fields = {};
  for (const field of Object.keys(LOCKED_EVENT_FIELDS)) fields[field] = event?.[field] ?? null;
  return { fields, deliverables: deliverableTerms(deliverables), costs: costTerms(costs) };
}

// A reopen taken before a field or key existed (deal_components, D14; a
// deliverable's platform and quantity, D15) did not record it: only what
// the snapshot holds is compared, so a deploy is never read as an edit.
function onlyKeysOf(beforeList, nowList) {
  const sample = (beforeList || [])[0];
  if (!sample) return nowList;
  const keys = Object.keys(sample);
  return nowList.map((entry) => Object.fromEntries(keys.map((k) => [k, entry[k] ?? null])));
}

/** The terms that changed between the reopen's `before` and now. */
function changedTerms(before, event, deliverables, costs) {
  const now = termsState(event, deliverables, costs);
  const nowFields = before?.fields
    ? Object.fromEntries(Object.entries(now.fields).filter(([k]) => Object.prototype.hasOwnProperty.call(before.fields, k)))
    : now.fields;
  const changed = before?.fields ? changedLockedFields(before.fields, nowFields, null) : [];
  if (!before || stable(before.deliverables || []) !== stable(onlyKeysOf(before.deliverables, now.deliverables))) changed.push('deliverables');
  if (!before || stable(before.costs || []) !== stable(now.costs)) changed.push('costs');
  return changed;
}

function parseObject(value, fallback) {
  let v = value;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch (err) {
      console.error('[TermsReopen] stored JSON did not parse, reading it as empty:', err.message);
      v = null;
    }
  }
  return v && typeof v === 'object' ? v : fallback;
}

function historyEntry(action, user, episodeId, extra = {}) {
  return {
    action,
    at: new Date().toISOString(),
    by: { id: user?.id ?? null, name: user?.name ?? user?.email ?? null },
    episode_id: episodeId ?? null,
    ...extra,
  };
}

/**
 * What Save and relock rebuilds, pure — each piece with the function Start
 * Episode uses for it (episodeGeneratorService.generateEpisodeFromEvent):
 *   brief terms snapshot       buildTermsSnapshot
 *   affordability warning      computeAffordabilityWarning (passed in)
 *   deliverable tasks          withDeliverableTasks on the episode's list;
 *                              a deliverable task that carries over keeps
 *                              its completion
 *   estimated money            calculateFinancials, feeding the todo list's
 *                              financial_summary and episodes.total_*
 */
function planTermsRebuild({ event, deliverables, briefEventMetadata, socialTasks, wardrobeItems, affordabilityWarning }) {
  const eventMetadata = {
    ...parseObject(briefEventMetadata, {}),
    terms: buildTermsSnapshot(event, deliverables),
    affordability_warning: affordabilityWarning ?? null,
  };

  let tasks = null;
  if (Array.isArray(socialTasks)) {
    const doneBefore = new Map(socialTasks.filter((t) => t?.deliverable_id).map((t) => [t.deliverable_id, !!t.completed]));
    tasks = withDeliverableTasks(socialTasks, deliverables)
      .map((t) => (t.deliverable_id && doneBefore.get(t.deliverable_id) ? { ...t, completed: true } : t));
  }

  const financials = calculateFinancials(event, wardrobeItems || []);
  return {
    eventMetadata,
    socialTasks: tasks,
    financials,
    episodeTotals: {
      total_income: financials.total_income,
      total_expenses: financials.total_expenses,
      financial_score: financials.net_profit >= 0 ? 7 : 4,
    },
  };
}

/**
 * The offer after a relock: regeneration is offered, never run here. The
 * invitation is offered when the event has one, the script when the episode
 * has one. mentionsMoney: the invitation's money statement
 * (describeInvitationMoney) states an earning or a cost — its kind is
 * 'earn' or 'cost', not 'comped' or 'neutral'. The script quotes the same
 * terms, so it shares the test.
 */
function regenerateOffer({ event, costs, deliverables, hasScript, changedFields }) {
  const money = describeInvitationMoney(event, { costs, deliverables });
  const mentionsMoney = money.kind === 'earn' || money.kind === 'cost';
  const remind = mentionsMoney && changedFields.length > 0;
  const offer = (offered, what) => ({
    offered,
    mentionsMoney,
    reminder: offered && remind ? `Terms changed; the ${what} mentions money. Regenerate?` : null,
  });
  return {
    invitation: offer(!!event.invitation_asset_id, 'invitation'),
    script: offer(!!hasScript, 'script'),
  };
}

async function eventExists(sequelize, showId, eventId) {
  const [rows] = await sequelize.query(
    'SELECT id FROM world_events WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL LIMIT 1',
    { replacements: { eventId, showId } }
  );
  return !!rows?.[0];
}

// Locks the episode row, then the event row (Complete's order), and returns
// the event as stored, or null.
async function lockEpisodeThenEvent(sequelize, showId, eventId, episodeId, transaction) {
  await sequelize.query('SELECT id FROM episodes WHERE id = :episodeId FOR UPDATE', { replacements: { episodeId }, transaction });
  const [rows] = await sequelize.query(
    'SELECT * FROM world_events WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL FOR UPDATE',
    { replacements: { eventId, showId }, transaction }
  );
  return rows?.[0] || null;
}

async function writeCanonConsequences(sequelize, eventId, cc, transaction) {
  await sequelize.query(
    'UPDATE world_events SET canon_consequences = CAST(:cc AS jsonb), updated_at = NOW() WHERE id = :eventId',
    { replacements: { eventId, cc: JSON.stringify(cc) }, transaction }
  );
}

/**
 * Reopens the terms. Returns { status, body }. Refuses: 400 without
 * confirm: true, 404 for an unknown event, 409 when already reopened or
 * when the ruling's test fails (with its reasons).
 */
async function reopenTerms(sequelize, { showId, eventId, user, confirm }) {
  if (confirm !== true) {
    return {
      status: 400,
      body: {
        success: false, code: CODES.CONFIRM_REQUIRED,
        error: 'Reopening locked terms needs confirmation: send confirm: true.',
      },
    };
  }
  const found = await findTermsLockEpisode(sequelize, eventId);
  if (!found) {
    if (!(await eventExists(sequelize, showId, eventId))) return { status: 404, body: { success: false, error: 'Event not found' } };
    return { status: 409, body: { success: false, code: CODES.NOT_ELIGIBLE, error: 'These terms are not locked.', reasons: eligibilityReasons({ lockEpisode: null }) } };
  }

  return sequelize.transaction(async (transaction) => {
    const event = await lockEpisodeThenEvent(sequelize, showId, eventId, found.id, transaction);
    if (!event) return { status: 404, body: { success: false, error: 'Event not found' } };

    // Re-checked under the locks: the episode, its ledger and the
    // deliverables as they are now.
    const check = await reopenEligibility(sequelize, eventId, { transaction });
    if (check.reopened) {
      return { status: 409, body: { success: false, code: CODES.ALREADY_REOPENED, error: 'These terms are already reopened.', reopened: check.reopened } };
    }
    if (!check.eligible) {
      return {
        status: 409,
        body: {
          success: false, code: CODES.NOT_ELIGIBLE,
          error: `These terms can't be reopened: ${check.reasons.map((r) => r.message).join(' ')}`,
          reasons: check.reasons,
        },
      };
    }

    const deliverables = await listEventDeliverables(sequelize, eventId, { transaction });
    const costs = await listEventCosts(sequelize, eventId, { transaction });
    const entry = historyEntry('terms_reopened', user, check.episode.id);
    const cc = parseObject(event.canon_consequences, {});
    cc[TERMS_REOPEN_KEY] = { at: entry.at, by: entry.by, episode_id: check.episode.id, before: termsState(event, deliverables, costs) };
    cc[TERMS_HISTORY_KEY] = [...(Array.isArray(cc[TERMS_HISTORY_KEY]) ? cc[TERMS_HISTORY_KEY] : []), entry];
    await writeCanonConsequences(sequelize, eventId, cc, transaction);

    return {
      status: 200,
      body: { success: true, reopened: { at: entry.at, by: entry.by, episode_id: check.episode.id }, episode: check.episode },
    };
  });
}

/**
 * Save and relock. Returns { status, body }: 404 for an unknown event, 409
 * TERMS_NOT_REOPENED when there is nothing to relock. Everything below
 * commits together or not at all.
 */
async function relockTerms(sequelize, { showId, eventId, user }) {
  const found = await findTermsLockEpisode(sequelize, eventId);
  if (!found) {
    if (!(await eventExists(sequelize, showId, eventId))) return { status: 404, body: { success: false, error: 'Event not found' } };
    return { status: 409, body: { success: false, code: CODES.NOT_REOPENED, error: 'These terms are not locked, so there is nothing to relock.' } };
  }

  return sequelize.transaction(async (transaction) => {
    const event = await lockEpisodeThenEvent(sequelize, showId, eventId, found.id, transaction);
    if (!event) return { status: 404, body: { success: false, error: 'Event not found' } };
    const marker = reopenMarkerOf(event.canon_consequences);
    if (!marker) {
      return { status: 409, body: { success: false, code: CODES.NOT_REOPENED, error: 'These terms are not reopened.' } };
    }
    const episodeId = found.id;

    const deliverables = await listEventDeliverables(sequelize, eventId, { transaction });
    const costs = await listEventCosts(sequelize, eventId, { transaction });
    const wardrobeItems = await loadFinancialWardrobeItems(sequelize, showId, { transaction });
    const affordabilityWarning = await computeAffordabilityWarning(sequelize, showId, event, { transaction });
    const [briefRows] = await sequelize.query(
      `SELECT id, event_metadata FROM episode_briefs
        WHERE episode_id = :episodeId AND deleted_at IS NULL
        ORDER BY (event_id = :eventId) DESC NULLS LAST, created_at DESC LIMIT 1`,
      { replacements: { episodeId, eventId }, transaction }
    );
    const [todoRows] = await sequelize.query(
      'SELECT id, social_tasks FROM episode_todo_lists WHERE episode_id = :episodeId AND deleted_at IS NULL LIMIT 1',
      { replacements: { episodeId }, transaction }
    );
    const [episodeRows] = await sequelize.query(
      'SELECT script_content FROM episodes WHERE id = :episodeId',
      { replacements: { episodeId }, transaction }
    );
    const brief = briefRows?.[0] || null;
    const todo = todoRows?.[0] || null;

    const plan = planTermsRebuild({
      event,
      deliverables,
      briefEventMetadata: brief?.event_metadata,
      socialTasks: todo ? parseObject(todo.social_tasks, []) : null,
      wardrobeItems,
      affordabilityWarning,
    });

    // Brief: terms snapshot + affordability warning.
    if (brief) {
      await sequelize.query(
        'UPDATE episode_briefs SET event_metadata = CAST(:meta AS jsonb), updated_at = NOW() WHERE id = :id',
        { replacements: { id: brief.id, meta: JSON.stringify(plan.eventMetadata) }, transaction }
      );
    }
    // Deliverable stamping.
    const stamped = await stampDeliverablesEpisode(sequelize, eventId, episodeId, { transaction });
    // Deliverable tasks + estimated money on the episode's todo list.
    if (todo) {
      await sequelize.query(
        `UPDATE episode_todo_lists SET social_tasks = CAST(:tasks AS jsonb), financial_summary = CAST(:fin AS jsonb), updated_at = NOW()
          WHERE id = :id`,
        { replacements: { id: todo.id, tasks: JSON.stringify(plan.socialTasks), fin: JSON.stringify(plan.financials) }, transaction }
      );
    }
    // Estimated money on the episode.
    await sequelize.query(
      `UPDATE episodes SET total_income = :total_income, total_expenses = :total_expenses,
              financial_score = :financial_score, updated_at = NOW()
        WHERE id = :episodeId`,
      { replacements: { episodeId, ...plan.episodeTotals }, transaction }
    );

    // Relock: clear the marker, record the save.
    const fields = changedTerms(marker.before, event, deliverables, costs);
    const entry = historyEntry('terms_relocked', user, episodeId, { fields, reopened_at: marker.at ?? null });
    const cc = parseObject(event.canon_consequences, {});
    delete cc[TERMS_REOPEN_KEY];
    cc[TERMS_HISTORY_KEY] = [...(Array.isArray(cc[TERMS_HISTORY_KEY]) ? cc[TERMS_HISTORY_KEY] : []), entry];
    await writeCanonConsequences(sequelize, eventId, cc, transaction);

    const hasScript = typeof episodeRows?.[0]?.script_content === 'string' && episodeRows[0].script_content.trim() !== '';
    return {
      status: 200,
      body: {
        success: true,
        relocked: { at: entry.at, by: entry.by, episode_id: episodeId },
        changed_fields: fields,
        rebuilt: {
          terms_snapshot: !!brief,
          affordability_warning: plan.eventMetadata.affordability_warning,
          deliverables_stamped: stamped,
          deliverable_tasks: !!todo,
          financials: plan.financials,
        },
        regenerate: regenerateOffer({ event, costs, deliverables, hasScript, changedFields: fields }),
      },
    };
  });
}

module.exports = {
  REOPEN_REASONS,
  CODES,
  eligibilityReasons,
  reopenEligibility,
  reopenTerms,
  relockTerms,
  planTermsRebuild,
  regenerateOffer,
  changedTerms,
  termsState,
};

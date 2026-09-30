'use strict';

/**
 * The deal type's first draft (deal build PR 2, docs/DEAL_DESIGN.md §2.2;
 * Task #2330).
 *
 * Evoni's answer to QUESTION 2 (docs/EVENT_EPISODE_FLOW.md §8(cc)): the deal
 * type is drafted by a fixed rule, not the AI, because it decides money.
 * The rule, in order:
 *   1. the opportunity's type, when the event came from one and the type is
 *      mapped (§6, QUESTION 9) — source 'opportunity';
 *   2. brand_partnership when host_brand is set and a live deliverable is
 *      owed to a brand — source 'rule';
 *   3. invited_comped for the invite, guest and upgrade event types;
 *   4. otherwise self_funded.
 *
 * The draft is recorded like every other drafted field (doctrine rule 14;
 * Task #2128): canon_consequences.automation.auto_drafted.deal_type holds the
 * source and automation.drafted_values.deal_type the drafted value. The
 * Event Package reads the field as Auto-drafted while the column equals the
 * copy and Edited once it differs.
 *
 * While the field is still Auto-drafted and the terms are not locked, the
 * draft follows the event: a deliverable, host_brand or event_type change
 * re-runs the rule (syncDraftedDealType). An Edited value, a locked event and
 * an event created before this PR (no draft recorded; D8, no backfill) are
 * never touched.
 */

const { findTermsLockEpisode } = require('../utils/eventTermsLock');

const DEAL_TYPE_SOURCES = Object.freeze({ OPPORTUNITY: 'opportunity', RULE: 'rule' });

// DEAL_DESIGN.md §6, approved as QUESTION 9.
const OPPORTUNITY_DEAL_TYPES = Object.freeze({
  modeling: 'paid_appearance',
  runway: 'paid_appearance',
  casting_call: 'paid_appearance',
  editorial: 'paid_deliverables',
  campaign: 'paid_deliverables',
  brand_deal: 'appearance_plus_deliverables',
  ambassador: 'brand_partnership',
  podcast: 'performance_booking',
  interview: 'performance_booking',
  panel: 'performance_booking',
  award_show: 'invited_comped',
  pr_gifting: 'gifted',
});

const COMPED_EVENT_TYPES = new Set(['invite', 'guest', 'upgrade']);

/** The rule itself: { deal_type, source } from what the event knows. */
function draftDealType({ event_type, host_brand, opportunity_type, deliverables } = {}) {
  const fromOpportunity = opportunity_type ? OPPORTUNITY_DEAL_TYPES[String(opportunity_type).trim().toLowerCase()] : null;
  if (fromOpportunity) return { deal_type: fromOpportunity, source: DEAL_TYPE_SOURCES.OPPORTUNITY };
  const hasBrand = typeof host_brand === 'string' && host_brand.trim() !== '';
  const owesBrand = (Array.isArray(deliverables) ? deliverables : []).some((d) => d && d.owed_to === 'brand');
  if (hasBrand && owesBrand) return { deal_type: 'brand_partnership', source: DEAL_TYPE_SOURCES.RULE };
  if (COMPED_EVENT_TYPES.has(event_type)) return { deal_type: 'invited_comped', source: DEAL_TYPE_SOURCES.RULE };
  return { deal_type: 'self_funded', source: DEAL_TYPE_SOURCES.RULE };
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[DealTypeDraft] canon_consequences parse failed:', err.message);
    return fallback;
  }
}

/**
 * Draft (initial: true) or re-draft the event's deal type, and record the
 * draft. Returns { deal_type, source } when it wrote one, else
 * { skipped: <reason> }. Never throws: a failure is logged and skipped, so
 * a create or edit path that calls it is never broken by it.
 *
 *   initial: true  — just after the event is created. Drafts unless the
 *                    creator already set deal_type.
 *   initial: false — after a deliverable, host_brand or event_type change.
 *                    Re-drafts only while the field is still Auto-drafted.
 */
async function syncDraftedDealType(sequelize, eventId, { initial = false } = {}) {
  if (!sequelize || typeof sequelize.transaction !== 'function' || !eventId) return { skipped: 'no_event' };
  try {
    return await sequelize.transaction(async (transaction) => {
      const [rows] = await sequelize.query(
        `SELECT id, event_type, host_brand, opportunity_id, deal_type, canon_consequences
           FROM world_events WHERE id = :eventId AND deleted_at IS NULL FOR UPDATE`,
        { replacements: { eventId }, transaction }
      );
      const event = rows?.[0];
      if (!event) return { skipped: 'not_found' };

      const cc = parseJson(event.canon_consequences, {}) || {};
      const automation = cc.automation || {};
      const draftedSource = automation.auto_drafted?.deal_type;
      const draftedValue = automation.drafted_values?.deal_type;

      if (initial) {
        if (event.deal_type != null && !draftedSource) return { skipped: 'set_by_creator' };
      } else {
        if (!draftedSource) return { skipped: 'not_drafted' };
        if (event.deal_type !== draftedValue) return { skipped: 'edited' };
      }

      if (await findTermsLockEpisode(sequelize, eventId, { transaction })) return { skipped: 'locked' };

      let opportunityType = null;
      if (event.opportunity_id) {
        const [opps] = await sequelize.query(
          'SELECT opportunity_type FROM opportunities WHERE id = :id LIMIT 1',
          { replacements: { id: event.opportunity_id }, transaction }
        );
        opportunityType = opps?.[0]?.opportunity_type || null;
      }
      const [deliverables] = await sequelize.query(
        'SELECT owed_to FROM event_deliverables WHERE event_id = :eventId AND deleted_at IS NULL',
        { replacements: { eventId }, transaction }
      );

      const draft = draftDealType({
        event_type: event.event_type,
        host_brand: event.host_brand,
        opportunity_type: opportunityType,
        deliverables,
      });
      if (!initial && draft.deal_type === event.deal_type && draft.source === draftedSource) {
        return { skipped: 'unchanged' };
      }

      const nextCc = {
        ...cc,
        automation: {
          ...automation,
          auto_drafted: { ...(automation.auto_drafted || {}), deal_type: draft.source },
          drafted_values: { ...(automation.drafted_values || {}), deal_type: draft.deal_type },
        },
      };
      await sequelize.query(
        `UPDATE world_events SET deal_type = :dealType, canon_consequences = :cc, updated_at = NOW()
          WHERE id = :eventId`,
        { replacements: { dealType: draft.deal_type, cc: JSON.stringify(nextCc), eventId }, transaction }
      );
      return draft;
    });
  } catch (err) {
    console.error(`[DealTypeDraft] draft for event ${eventId} failed:`, err.message);
    return { skipped: 'error' };
  }
}

module.exports = {
  DEAL_TYPE_SOURCES,
  OPPORTUNITY_DEAL_TYPES,
  draftDealType,
  syncDraftedDealType,
};

'use strict';

/**
 * Secondary events of an episode: step 1 (Evoni's rulings, 2026-11-12).
 *
 * An episode has one primary event, the one its brief names
 * (episode_briefs.event_id), and may have secondary events: other events
 * whose own link (world_events.used_in_episode_id) points at the episode.
 * No new table, column or role: these are the two links that exist.
 *
 * What this module is, and all it is:
 *   attachEnabled             the switch for NEW secondary attachments
 *                             (MULTI_EVENT_ATTACH_ENABLED, off unless exactly
 *                             "true"). It gates attaching only: reads,
 *                             detach and the safety checks below ignore it.
 *   eventObligations          whether an event carries any financial,
 *                             contractual, payment, cost or deliverable
 *                             obligation, from the records that hold them.
 *                             Anything it cannot read or classify counts.
 *   secondaryEventsOf         the episode's secondary events
 *   classifyLink              first link, primary restored, or secondary
 *   assertSecondaryAttach     the checks before a secondary attachment
 *   assertSecondaryCandidates the same, before an episode exists (Start)
 *   attachSecondaryInStart    the link and snapshot inside Start's transaction
 *   assertNoUnsupportedSecondaryObligations
 *                             the backstop for filming and completion
 *   detachSecondaryEvent      remove a secondary event before filming
 *
 * The interim obligations gate: until the money and deliverable readers
 * handle several events, a secondary event must carry no obligation. A
 * secondary event that has one is refused at attach, and an episode that
 * somehow has one is refused at the first clip and at completion, never
 * silently skipped.
 *
 * The unique index world_events_used_in_episode_unique is unchanged, so a
 * second event's own link still cannot be written: that conflict is answered
 * 409 EPISODE_EVENT_LINK_TAKEN (utils/eventEpisodeLink.js).
 */

const { filmedAt } = require('../utils/frozenEpisode');
const { isDealEvent } = require('../utils/dealComponents');
const { lockEpisodes } = require('../utils/episodeLocks');
const { reopenMarkerOf } = require('../utils/eventTermsLock');

const SWITCH = 'MULTI_EVENT_ATTACH_ENABLED';
const attachEnabled = (env = process.env) => String(env[SWITCH] || '').trim().toLowerCase() === 'true';

const CODES = Object.freeze({
  NOT_ENABLED: 'SECONDARY_EVENTS_NOT_ENABLED',
  PRIMARY_REQUIRED: 'PRIMARY_EVENT_REQUIRED',
  HAS_OBLIGATIONS: 'SECONDARY_EVENT_HAS_OBLIGATIONS',
  UNSUPPORTED_OBLIGATIONS: 'UNSUPPORTED_SECONDARY_OBLIGATIONS',
  EPISODE_FILMED: 'EPISODE_SNAPSHOT_FROZEN',
  ALREADY_LINKED: 'EVENT_ALREADY_HAS_EPISODE',
  IS_PRIMARY: 'PRIMARY_EVENT_NOT_DETACHABLE',
  IN_USE: 'SECONDARY_EVENT_IN_USE',
  TERMS_REOPENED: 'EVENT_TERMS_REOPENED',
  REASON_REQUIRED: 'DETACH_REASON_REQUIRED',
  INJECT_UNSUPPORTED: 'SECONDARY_EVENT_INJECT_UNSUPPORTED',
  REGENERATE_UNSUPPORTED: 'EPISODE_HAS_SECONDARY_EVENTS',
});

class SecondaryEventError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.name = 'SecondaryEventError';
    this.status = status;
    this.statusCode = status;
    this.code = code;
    this.details = details;
  }

  toJSON() {
    return { success: false, error: this.message, code: this.code, ...this.details };
  }
}
const isSecondaryEventError = (err) => err instanceof SecondaryEventError;

// Opportunity statuses that conclusively end an offer (services/startOfferDecision
// CLOSED_STATUSES). Every other status, a missing one included, is open.
const { CLOSED_STATUSES } = require('./startOfferDecision');

const tx = (transaction) => (transaction ? { transaction } : {});

function parseJson(value) {
  if (value == null || typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[secondaryEvents] stored JSON did not parse, so it counts as holding something:', err.message);
    return Symbol.for('unreadable');
  }
}
const UNREADABLE = Symbol.for('unreadable');
/** A stored list or object that holds anything. Unreadable text counts as holding something. */
function holdsSomething(value) {
  const v = parseJson(value);
  if (v == null) return false;
  if (v === UNREADABLE) return true;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  if (typeof v === 'string') return v.trim() !== '';
  return Boolean(v);
}
/** An amount field: null and 0 are "none"; anything else, a value that is not a number included, is an obligation. */
function amountSet(value) {
  if (value == null || value === '') return false;
  const n = Number(value);
  return !Number.isFinite(n) || n !== 0;
}

const EVENT_FIELDS = `id, name, show_id, used_in_episode_id, status, deal_type, deal_components, appearance_required,
  is_paid, payment_amount, appearance_fee, partnership_base_fee, performance_fee, gifted_value, bonus_terms,
  restrictions, requirements, cost_coins, scene_set_id, invitation_asset_id, outfit_set_id, outfit_pieces, canon_consequences`;

/**
 * The obligations an event carries. { known, obligations: [{ kind, detail }] }.
 * known is false when a record could not be read: the caller treats that as
 * an obligation (fail closed). Zero-value, waived, deferred and pending
 * commitments count, because their records exist: a deliverable with no fee,
 * a cost with no amount, a deal whose fee is 0, an offer not yet decided.
 */
async function eventObligations(sequelize, eventOrId, { transaction } = {}) {
  const obligations = [];
  let known = true;
  const add = (kind, detail) => obligations.push({ kind, detail });
  const unknown = (kind, err) => {
    known = false;
    console.error(`[secondaryEvents] ${kind} could not be read, so it counts as an obligation:`, err?.message || err);
    add(kind, 'could not be read, so it counts as an obligation');
  };

  let event = eventOrId && typeof eventOrId === 'object' ? eventOrId : null;
  const eventId = event ? event.id : eventOrId;
  if (!event || event.deal_type === undefined || event.cost_coins === undefined) {
    try {
      const [rows] = await sequelize.query(`SELECT ${EVENT_FIELDS} FROM world_events WHERE id = :eventId AND deleted_at IS NULL LIMIT 1`,
        { replacements: { eventId }, ...tx(transaction) });
      event = rows?.[0] || null;
    } catch (err) {
      unknown('event', err);
    }
  }
  if (!event) {
    if (known) { known = false; add('event', 'not found, so it cannot be classified'); }
    return { known, obligations, event: null };
  }

  // The deal and its money, on the event row.
  if (isDealEvent(event)) add('deal', `deal: ${event.deal_type || 'components set'}`);
  if (event.is_paid === true || event.is_paid === 'true') add('payment', 'marked as paid work');
  for (const [field, label] of [['payment_amount', 'payment'], ['appearance_fee', 'appearance fee'], ['partnership_base_fee', 'partnership fee'],
    ['performance_fee', 'performance fee'], ['gifted_value', 'gifted value'], ['cost_coins', 'entry cost']]) {
    if (amountSet(event[field])) add(field === 'cost_coins' ? 'cost' : 'payment', `${label} set`);
  }
  if (holdsSomething(event.bonus_terms)) add('contract', 'bonus terms');
  if (holdsSomething(event.restrictions)) add('contract', 'restrictions');
  if (holdsSomething(event.requirements)) add('contract', 'access requirements');

  // Its records elsewhere. Each read that fails counts.
  const count = async (kind, sql, detail) => {
    try {
      const [rows] = await sequelize.query(sql, { replacements: { eventId: event.id, closed: CLOSED_STATUSES }, ...tx(transaction) });
      const n = parseInt(rows?.[0]?.n, 10) || 0;
      if (n > 0) add(kind, detail(n));
    } catch (err) {
      unknown(kind, err);
    }
  };
  const many = (n, one, plural) => `${n} ${n === 1 ? one : plural}`;
  await count('deliverable', 'SELECT COUNT(*) AS n FROM event_deliverables WHERE event_id = :eventId AND deleted_at IS NULL',
    (n) => many(n, 'deliverable', 'deliverables'));
  await count('cost', 'SELECT COUNT(*) AS n FROM event_costs WHERE event_id = :eventId AND deleted_at IS NULL',
    (n) => many(n, 'itemised cost', 'itemised costs'));
  await count('offer', `SELECT COUNT(*) AS n FROM opportunities WHERE event_id = :eventId AND deleted_at IS NULL
                           AND (status IS NULL OR status NOT IN (:closed))`,
  (n) => many(n, 'opportunity that is not closed or rejected', 'opportunities that are not closed or rejected'));
  await count('price', 'SELECT COUNT(*) AS n FROM deal_price_snapshots WHERE event_id = :eventId AND deleted_at IS NULL',
    (n) => many(n, 'agreed price line', 'agreed price lines'));
  await count('ledger', `SELECT COUNT(*) AS n FROM financial_transactions WHERE deleted_at IS NULL
                            AND (event_id = :eventId OR source_id = :eventId OR source_id IN (SELECT id FROM event_deliverables WHERE event_id = :eventId))`,
  (n) => many(n, 'ledger row', 'ledger rows'));

  return { known, obligations, event };
}

/** The episode's primary event id: the one its live brief names, or null. */
async function primaryEventId(sequelize, episodeId, { transaction } = {}) {
  const [rows] = await sequelize.query(
    'SELECT event_id FROM episode_briefs WHERE episode_id = :episodeId AND deleted_at IS NULL LIMIT 1',
    { replacements: { episodeId }, ...tx(transaction) });
  return rows?.[0]?.event_id || null;
}

/**
 * The episode's secondary events: the live events whose own link points at
 * it, less its primary. With no brief event the oldest linked event is the
 * primary (services/episodeEventsService), and the rest are secondary.
 */
async function secondaryEventsOf(sequelize, episodeId, { transaction } = {}) {
  const primary = await primaryEventId(sequelize, episodeId, { transaction });
  const [rows] = await sequelize.query(
    `SELECT ${EVENT_FIELDS} FROM world_events WHERE used_in_episode_id = :episodeId AND deleted_at IS NULL ORDER BY created_at ASC, id ASC`,
    { replacements: { episodeId }, ...tx(transaction) });
  const linked = rows || [];
  const primaryId = primary || linked[0]?.id || null;
  return { primaryId, briefNamesPrimary: Boolean(primary), secondary: linked.filter((e) => e.id !== primaryId) };
}

/**
 * What linking this event to this episode would be:
 *   'primary'   the brief already names this event (its own link restored)
 *   'first'     the episode has no primary and no linked event (as before)
 *   'secondary' the episode already has an event: a secondary attachment
 */
async function classifyLink(sequelize, { eventId, episodeId, transaction } = {}) {
  const { primaryId, briefNamesPrimary, secondary } = await secondaryEventsOf(sequelize, episodeId, { transaction });
  if (primaryId && String(primaryId) === String(eventId)) return { kind: 'primary', primaryId, briefNamesPrimary };
  if (secondary.some((e) => String(e.id) === String(eventId))) return { kind: 'linked', primaryId, briefNamesPrimary };
  if (!primaryId) return { kind: 'first', primaryId: null, briefNamesPrimary: false };
  return { kind: 'secondary', primaryId, briefNamesPrimary };
}

function notEnabledError() {
  return new SecondaryEventError(409, CODES.NOT_ENABLED,
    'This episode already has its event, and linking a second event to an episode is not switched on yet. Nothing was changed.');
}
function obligationsError(event, obligations, code = CODES.HAS_OBLIGATIONS) {
  const what = [...new Set(obligations.map((o) => o.detail))].slice(0, 6).join('; ');
  return new SecondaryEventError(409, code,
    `"${event?.name || 'This event'}" carries commitments (${what}). An event with a deal, a payment, a cost, a deliverable or an open offer cannot be a second event of an episode yet. Nothing was changed.`,
    { event_id: event?.id ?? null, obligations });
}

function alreadyLinkedError(ev, live) {
  return new SecondaryEventError(409, CODES.ALREADY_LINKED,
    `"${ev.name || 'An event'}" already belongs to ${live.title ? `"${live.title}"` : 'an episode'}. An event belongs to one episode. Nothing was created.`,
    { event_id: ev.id, episode: { id: live.id, title: live.title ?? null } });
}

/**
 * A regenerate replaces an episode and moves its primary event to the new
 * one. Its other events would be left on the replaced episode, so an
 * episode that has any is not regenerated yet. No single-event episode is
 * affected.
 */
async function assertRegenerateHasNoSecondary(sequelize, { episodeId, eventId, transaction } = {}) {
  const [rows] = await sequelize.query(
    'SELECT id, name FROM world_events WHERE used_in_episode_id = :episodeId AND id <> :eventId AND deleted_at IS NULL ORDER BY created_at ASC',
    { replacements: { episodeId, eventId }, ...tx(transaction) });
  if (!rows?.length) return;
  throw new SecondaryEventError(409, CODES.REGENERATE_UNSUPPORTED,
    `This episode has ${rows.length === 1 ? 'another event' : `${rows.length} other events`} linked to it (${rows.map((r) => `"${r.name}"`).join(', ')}), and regenerating would leave ${rows.length === 1 ? 'it' : 'them'} behind on the replaced episode. Nothing was changed.`,
    { episode_id: episodeId, events: rows.map((r) => ({ id: r.id, name: r.name ?? null })) });
}

/** The gate, for one event. Throws when it carries any obligation or cannot be classified. */
async function assertNoObligations(sequelize, eventOrId, { transaction, code } = {}) {
  const { obligations, event } = await eventObligations(sequelize, eventOrId, { transaction });
  if (obligations.length) throw obligationsError(event || (typeof eventOrId === 'object' ? eventOrId : { id: eventOrId }), obligations, code);
}

/**
 * Before an event's own link is pointed at an episode, in the writing
 * transaction with the episode locked. Returns the link's kind. Only a
 * secondary attachment is checked: a first link and the primary's own link
 * restored are as before, whatever the switch says.
 *   switch on; the brief names the primary; the episode is not filmed; the
 *   event carries no obligation.
 */
async function assertSecondaryAttach(sequelize, { eventId, episodeId, transaction, env = process.env } = {}) {
  const link = await classifyLink(sequelize, { eventId, episodeId, transaction });
  if (link.kind !== 'secondary') return link;
  if (!attachEnabled(env)) throw notEnabledError();
  if (!link.briefNamesPrimary) {
    throw new SecondaryEventError(409, CODES.PRIMARY_REQUIRED,
      'This episode\'s brief names no source event yet. Name its primary event first; then other events can be linked to it. Nothing was changed.',
      { episode_id: episodeId });
  }
  const frozenAt = await filmedAt(sequelize, episodeId, { transaction });
  if (frozenAt) {
    throw new SecondaryEventError(409, CODES.EPISODE_FILMED,
      `This episode has been filmed (since ${String(frozenAt).slice(0, 10)}), so no other event can be linked to it. Nothing was changed.`,
      { episode_id: episodeId, event_id: eventId, frozen_at: frozenAt, fields: ['used_in_episode_id'] });
  }
  await assertNoObligations(sequelize, eventId, { transaction });
  return link;
}

/**
 * Before Start creates anything: every extra event must be attachable, or
 * nothing is created. Asked again, per event, inside Start's transaction.
 */
async function assertSecondaryCandidates(sequelize, events, { env = process.env } = {}) {
  if (!events?.length) return;
  if (!attachEnabled(env)) throw notEnabledError();
  const { findLiveLinkedEpisode } = require('../utils/eventEpisodeLink');
  const { findFrozenDeletedEpisode, restartRefusal } = require('../utils/frozenEpisode');
  for (const ev of events) {
    const live = await findLiveLinkedEpisode(sequelize, ev.id);
    if (live) throw alreadyLinkedError(ev, live);
    const frozen = await findFrozenDeletedEpisode(sequelize, ev.id);
    if (frozen) throw restartRefusal(ev.id, frozen);
    await assertNoObligations(sequelize, ev.id);
  }
}

/**
 * One secondary event, inside Start's transaction, after the new episode,
 * its brief and the primary's link exist. The event row is locked by the
 * caller (in id order with the others). Asked again under the lock, linked
 * only if it has no live episode, and its (empty) price snapshot taken in
 * the same commit. Any failure rolls the whole Start back.
 */
async function attachSecondaryInStart(sequelize, { event, episodeId, transaction, stampEventUsed, takePriceSnapshot, env = process.env }) {
  if (!attachEnabled(env)) throw notEnabledError();
  const { findLiveLinkedEpisode } = require('../utils/eventEpisodeLink');
  const { findFrozenDeletedEpisode, restartRefusal } = require('../utils/frozenEpisode');
  const live = await findLiveLinkedEpisode(sequelize, event.id, { transaction });
  if (live) throw alreadyLinkedError(event, live);
  const frozen = await findFrozenDeletedEpisode(sequelize, event.id, { transaction });
  if (frozen) throw restartRefusal(event.id, frozen);
  await assertNoObligations(sequelize, event.id, { transaction });
  await stampEventUsed(sequelize, event.id, episodeId, { transaction });
  await takePriceSnapshot(sequelize, event.id, { transaction, reason: 'linked_episode' });
  return { id: event.id, name: event.name ?? null };
}

/**
 * The backstop (filming, completion): the episode's secondary events that
 * carry an obligation, or cannot be classified. Empty for an episode with
 * no secondary event, which is every single-event episode.
 */
async function unsupportedSecondaryObligations(sequelize, episodeId, { transaction } = {}) {
  const { secondary } = await secondaryEventsOf(sequelize, episodeId, { transaction });
  const found = [];
  for (const ev of secondary) {
    const { obligations } = await eventObligations(sequelize, ev, { transaction });
    if (obligations.length) found.push({ id: ev.id, name: ev.name ?? null, obligations });
  }
  return found;
}

async function assertNoUnsupportedSecondaryObligations(sequelize, episodeId, { transaction, doing = 'be completed' } = {}) {
  const found = await unsupportedSecondaryObligations(sequelize, episodeId, { transaction });
  if (!found.length) return;
  const names = found.map((e) => `"${e.name || 'an event'}"`).join(', ');
  throw new SecondaryEventError(409, CODES.UNSUPPORTED_OBLIGATIONS,
    `This episode has a second event with commitments that are not handled for second events yet (${names}), so it cannot ${doing}. Nothing was changed. Remove the event from the episode, or wait until its commitments are supported.`,
    { episode_id: episodeId, events: found });
}

// ── Detach ────────────────────────────────────────────────────────────────

/**
 * What in the episode's production still depends on this event. Each entry
 * is { kind, detail }. A read that fails is itself an entry: an uncertain
 * case is refused.
 */
async function downstreamReferences(sequelize, { event, episodeId, transaction } = {}) {
  const refs = [];
  const check = async (kind, detail, sql, replacements = {}) => {
    try {
      const [rows] = await sequelize.query(sql, { replacements: { eventId: event.id, episodeId, ...replacements }, ...tx(transaction) });
      const n = parseInt(rows?.[0]?.n, 10) || 0;
      if (n > 0) refs.push({ kind, detail: typeof detail === 'function' ? detail(n) : detail });
    } catch (err) {
      console.error(`[secondaryEvents] ${kind} reference could not be read, so the detach is refused:`, err.message);
      refs.push({ kind, detail: 'could not be checked' });
    }
  };
  // Script: inject writes an [EVENT: name="…"] tag.
  if (event.name) {
    await check('script', 'the script has this event\'s tag',
      'SELECT COUNT(*) AS n FROM episodes WHERE id = :episodeId AND script_content LIKE :tag',
      { tag: `%[EVENT: name="${String(event.name).replace(/[%_\\]/g, (c) => `\\${c}`)}"%` });
  }
  // Invitation: the event's invitation asset placed on the episode.
  if (event.invitation_asset_id) {
    await check('invitation', 'its invitation is on this episode',
      'SELECT COUNT(*) AS n FROM assets WHERE id = :assetId AND episode_id = :episodeId AND deleted_at IS NULL', { assetId: event.invitation_asset_id });
    await check('invitation', 'the episode\'s brief uses its invitation',
      'SELECT COUNT(*) AS n FROM episode_briefs WHERE episode_id = :episodeId AND invitation_asset_id = :assetId AND deleted_at IS NULL', { assetId: event.invitation_asset_id });
  }
  // Location: the event's scene set among the episode's locations (and so in its scenes and beat plan).
  if (event.scene_set_id) {
    await check('location', 'its place is one of this episode\'s locations',
      'SELECT COUNT(*) AS n FROM scene_set_episodes WHERE episode_id = :episodeId AND scene_set_id = :sceneSetId AND deleted_at IS NULL', { sceneSetId: event.scene_set_id });
  }
  // Wardrobe: nothing records which event a wardrobe row came from, so an
  // event with a look on an episode that has wardrobe is uncertain.
  if (event.outfit_set_id || holdsSomething(event.outfit_pieces)) {
    await check('wardrobe', 'it has a look and this episode has wardrobe, which may come from it',
      'SELECT COUNT(*) AS n FROM episode_wardrobe WHERE episode_id = :episodeId AND deleted_at IS NULL');
  }
  // Money plan, posts and moments that name both the event and the episode.
  await check('money', (n) => `${n} spending line${n === 1 ? '' : 's'} of this episode`,
    'SELECT COUNT(*) AS n FROM episode_spending_lines WHERE episode_id = :episodeId AND event_id = :eventId AND deleted_at IS NULL');
  await check('deliverable', (n) => `${n} deliverable${n === 1 ? '' : 's'} assigned to this episode`,
    'SELECT COUNT(*) AS n FROM event_deliverables WHERE event_id = :eventId AND episode_id = :episodeId AND deleted_at IS NULL');
  for (const [table, column, label] of [['feed_posts', 'event_id', 'feed post'], ['feed_moments', 'event_id', 'feed moment'],
    ['pulse_polls', 'world_event_id', 'poll'], ['pulse_reveals', 'event_id', 'reveal'], ['camera_roll_moments', 'event_id', 'camera roll moment']]) {
    await check('production', (n) => `${n} ${label}${n === 1 ? '' : 's'} made for it in this episode`,
      `SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = :eventId AND episode_id = :episodeId`);
  }
  return refs;
}

/**
 * Remove a secondary event from its episode, before filming. One
 * transaction; a repeat is a no-op; every outcome is written to the activity
 * log (event, episode, actor, reason, outcome; the row's own time).
 *
 * Refused, with what blocks it: the primary event; a filmed episode;
 * reopened terms; any obligation; anything in production that still depends
 * on it (the impact review, in depends_on). Nothing is deleted: on success
 * the event's link is cleared, its status returns to 'draft' and its price
 * snapshot is closed.
 */
async function detachSecondaryEvent(sequelize, models, { eventId, showId, userId = null, reason } = {}) {
  const why = typeof reason === 'string' ? reason.trim().slice(0, 500) : '';
  if (!why) throw new SecondaryEventError(400, CODES.REASON_REQUIRED, 'Say why this event is being removed from the episode.');

  const log = async (changes, transaction = null) => {
    try {
      await models.ActivityLog.logActivity({
        userId, action: 'detach_secondary_event', resourceType: 'world_event', resourceId: eventId, changes: { reason: why, ...changes },
      }, transaction ? { transaction } : {});
    } catch (err) {
      if (transaction) throw err; // a detach that cannot be audited does not happen
      console.error('[secondaryEvents] detach outcome could not be logged:', err.message);
    }
  };

  let refusal = null;
  let episodeIdSeen = null;
  const result = await sequelize.transaction(async (transaction) => {
    const [seen] = await sequelize.query(`SELECT used_in_episode_id FROM world_events WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL`,
      { replacements: { eventId, showId }, transaction });
    if (!seen?.[0]) throw new SecondaryEventError(404, 'EVENT_NOT_FOUND', 'Event not found');
    const episodeId = seen[0].used_in_episode_id;
    episodeIdSeen = episodeId;
    if (!episodeId) return { success: true, detached: false, already: true, event_id: eventId, episode_id: null };

    // Episode first, then the event (the order every other writer takes).
    await lockEpisodes(sequelize, [episodeId], { transaction });
    // The same lock Start Episode, inject and a delete take on the event.
    await require('../utils/eventEpisodeLink').lockLiveEvent(sequelize, eventId, { transaction });
    const [rows] = await sequelize.query(`SELECT ${EVENT_FIELDS} FROM world_events WHERE id = :eventId AND deleted_at IS NULL`,
      { replacements: { eventId }, transaction });
    const event = rows?.[0];
    if (!event || event.used_in_episode_id !== episodeId) {
      // Changed while waiting for the locks: nothing is assumed.
      return { success: true, detached: false, already: !event?.used_in_episode_id, event_id: eventId, episode_id: event?.used_in_episode_id ?? null };
    }
    const refuse = (code, message, details = {}) => { refusal = new SecondaryEventError(409, code, message, { event_id: eventId, episode_id: episodeId, ...details }); return null; };

    const { primaryId } = await secondaryEventsOf(sequelize, episodeId, { transaction });
    if (String(primaryId) === String(eventId)) {
      return refuse(CODES.IS_PRIMARY, 'This is the episode\'s primary event: it stays with its episode. Nothing was changed.');
    }
    const frozenAt = await filmedAt(sequelize, episodeId, { transaction });
    if (frozenAt) {
      return refuse(CODES.EPISODE_FILMED, `This episode has been filmed (since ${String(frozenAt).slice(0, 10)}), so its events can no longer change. Nothing was changed.`, { frozen_at: frozenAt });
    }
    if (reopenMarkerOf(event.canon_consequences)) {
      return refuse(CODES.TERMS_REOPENED, `The terms of "${event.name || 'this event'}" are reopened. Save and relock them first. Nothing was changed.`);
    }
    // The price snapshot the link took is closed below; every other obligation blocks.
    const { obligations } = await eventObligations(sequelize, event, { transaction });
    const blocking = obligations.filter((o) => o.kind !== 'price');
    const depends = await downstreamReferences(sequelize, { event, episodeId, transaction });
    if (blocking.length || depends.length) {
      const list = [...blocking, ...depends].map((d) => d.detail);
      return refuse(CODES.IN_USE,
        `"${event.name || 'This event'}" cannot be removed from the episode yet: ${[...new Set(list)].slice(0, 8).join('; ')}. Nothing was changed.`,
        { depends_on: depends, obligations: blocking });
    }

    await sequelize.query(
      `UPDATE world_events SET used_in_episode_id = NULL, status = 'draft', updated_at = NOW() WHERE id = :eventId AND used_in_episode_id = :episodeId`,
      { replacements: { eventId, episodeId }, transaction });
    await sequelize.query('UPDATE deal_price_snapshots SET deleted_at = NOW(), updated_at = NOW() WHERE event_id = :eventId AND deleted_at IS NULL',
      { replacements: { eventId }, transaction });
    await log({ episode_id: episodeId, outcome: 'detached', previous_status: event.status ?? null }, transaction);
    return { success: true, detached: true, already: false, event_id: eventId, episode_id: episodeId, status: 'draft' };
  });

  if (refusal) {
    await log({ episode_id: episodeIdSeen, outcome: 'refused', code: refusal.code });
    throw refusal;
  }
  if (result && result.detached === false) await log({ episode_id: result.episode_id, outcome: 'nothing_to_do' });
  return result;
}

module.exports = {
  SWITCH,
  CODES,
  SecondaryEventError,
  isSecondaryEventError,
  attachEnabled,
  eventObligations,
  primaryEventId,
  secondaryEventsOf,
  classifyLink,
  assertNoObligations,
  assertSecondaryAttach,
  assertSecondaryCandidates,
  attachSecondaryInStart,
  assertRegenerateHasNoSecondary,
  unsupportedSecondaryObligations,
  assertNoUnsupportedSecondaryObligations,
  downstreamReferences,
  detachSecondaryEvent,
  amountSet,
  holdsSomething,
};

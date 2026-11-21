'use strict';

/**
 * What the Event Package shows about where an event goes next (Evoni,
 * 2026-10-25: "I want them all and show me first"), for GET
 * /world/:showId/events/:eventId/flow. Read-only, no AI. Three parts, each
 * failing on its own (a failed part is null, its message under
 * errors.<part>), like the combined package GET:
 *
 *   beat14    who at the event can offer beat 14's opportunity and the
 *             show's open opportunity that fits it best (beat14Fit, the
 *             ranking beat 14's picker uses); the one attached to the
 *             event's episode once it has one; with nothing open that fits,
 *             the "Suggest one" draft (draftSuggestion), unsaved.
 *   defaults  smartDefaults (utils/eventFlowChecks): the brand host's usual
 *             dress code, prestige and deal type, the venue's dress code.
 *   clashes   clashes (utils/eventFlowChecks): the same in-world day, a
 *             person double-booked that day, and the affordability check
 *             (financialPressureService.checkAffordability against the
 *             ledger balance, as GET …/affordability answers it).
 *   schedule  scheduleCheck (utils/eventFlowChecks; continuity PR 1,
 *             Evoni 2026-11-13): when the event runs, and who at it is at
 *             another event whose time overlaps or leaves too little time
 *             to travel. Warnings only: nothing is refused or saved.
 */

const {
  smartDefaults, clashes, scheduleCheck, participantsOf, travelMinutesOf, venueIdOf,
} = require('../utils/eventFlowChecks');

const FLOW_PARTS = Object.freeze(['beat14', 'defaults', 'clashes', 'schedule']);
const OPEN_STATUSES = ['offered', 'considering', 'negotiating'];

const plain = (o) => (o && typeof o.get === 'function' ? o.get({ plain: true }) : o);
const slim = (o) => (o ? {
  id: o.id, name: o.name, opportunity_type: o.opportunity_type, status: o.status,
  brand_or_company: o.brand_or_company || null, payment_amount: o.payment_amount != null ? Number(o.payment_amount) : null,
} : null);

/** The show's other live events, newest first (the rows smartDefaults and clashes read). */
async function otherEvents(sequelize, { showId, eventId }) {
  return sequelize.query(
    `SELECT id, name, host_brand, dress_code, prestige, deal_type, venue_location_id, event_date,
            event_time, status, used_in_episode_id, invitation_asset_id, opportunity_id,
            source_profile_id, canon_consequences
       FROM world_events
      WHERE show_id = :showId AND deleted_at IS NULL AND id <> :eventId
      ORDER BY created_at DESC
      LIMIT 500`,
    { replacements: { showId, eventId }, type: sequelize.QueryTypes.SELECT }
  );
}

async function beat14Preview(models, { showId, event }) {
  const { eventPeople, fitContext } = require('./beat14Opportunity');
  const { rankCandidates, draftSuggestion } = require('./beat14Fit');
  const people = await eventPeople(models.sequelize, event);
  const host = people.find((p) => p.role === 'host') || null;
  const episodeId = event.used_in_episode_id || null;
  const ctx = await fitContext(models, { showId, event, people });
  let attached = null;
  if (episodeId && models.Opportunity) {
    const row = await models.Opportunity.findOne({ where: { offered_in_episode_id: episodeId } });
    if (row) attached = slim(plain(row));
  }
  let ranked = [];
  if (models.Opportunity) {
    const { Op } = require('sequelize');
    const open = await models.Opportunity.findAll({
      where: { show_id: showId, status: { [Op.in]: OPEN_STATUSES }, offered_in_episode_id: null },
      order: [['created_at', 'DESC']],
      limit: 50,
    });
    ranked = rankCandidates(open.map(plain), ctx);
  }
  const fits = ranked.filter((c) => c.fit.score > 0);
  const best = fits[0] ? { ...slim(fits[0]), fit: fits[0].fit } : null;
  // Nothing open fits: what "Suggest one" would draft from the host (or the
  // first guest), moving the first goal nothing in the season moves yet.
  let draft = null;
  const from = host || people[0] || null;
  if (!best && from) {
    const brand = ctx.brands.find((b) => b.person === from.name && b.role === from.role)?.name
      || (from.role === 'host' ? ctx.brands.find((b) => b.role === 'host')?.name : null) || null;
    const goal = (ctx.goals || []).find((g) => g.target_metric !== 'stress') || null;
    draft = draftSuggestion({ event, person: from, brand, goal });
  }
  return {
    episode_id: episodeId,
    host: host ? { profile_id: host.profile_id, name: host.name } : null,
    people: people.length,
    attached,
    best,
    others: Math.max(0, fits.length - 1),
    draft: draft ? { name: draft.name, opportunity_type: draft.opportunity_type, from: from.name } : null,
  };
}

async function venueOf(models, event) {
  let cc = event.canon_consequences;
  if (typeof cc === 'string') {
    try { cc = JSON.parse(cc); } catch (err) { console.error('[EventFlow] canon_consequences is not valid JSON:', err.message); cc = {}; }
  }
  const id = event.venue_location_id || cc?.automation?.venue_location_id || null;
  if (!id || !models.WorldLocation) return null;
  const loc = await models.WorldLocation.findByPk(id, { attributes: ['id', 'name', 'venue_details'] });
  if (!loc) return null;
  const details = loc.venue_details && typeof loc.venue_details === 'object' ? loc.venue_details : {};
  return { id: loc.id, name: loc.name, dress_code: typeof details.dress_code === 'string' ? details.dress_code.trim() || null : null };
}

async function affordabilityOf(models, { showId, event }) {
  // An event that has started its episode is paid from the episode's money.
  if (event.used_in_episode_id) return null;
  const { getCurrentBalance } = require('./financialTransactionService');
  const { checkAffordability } = require('./financialPressureService');
  const balance = await getCurrentBalance(models.sequelize, showId);
  return { ...checkAffordability(event, balance), balance };
}

/**
 * How Lala is linked to each event, by its id (Evoni, 2026-11-13): an
 * approved invitation is 'invited', a season slot 'planned', an accepted
 * offer 'confirmed', a linked episode 'committed'. The strongest wins; an
 * event she is not linked to is left out, and she is not checked for it.
 */
async function lalaLinks(sequelize, events) {
  const { ACCEPTED_STATUSES } = require('./startOfferDecision');
  const ids = events.map((e) => e.id);
  const links = {};
  if (!ids.length) return links;
  const slotted = new Set((await sequelize.query(
    'SELECT DISTINCT event_id FROM season_slots WHERE event_id IN (:ids) AND deleted_at IS NULL',
    { replacements: { ids }, type: sequelize.QueryTypes.SELECT }
  )).map((r) => String(r.event_id)));
  const oppIds = [...new Set(events.map((e) => e.opportunity_id).filter(Boolean))];
  const accepted = new Set(oppIds.length ? (await sequelize.query(
    'SELECT id FROM opportunities WHERE id IN (:oppIds) AND status IN (:statuses) AND deleted_at IS NULL',
    { replacements: { oppIds, statuses: ACCEPTED_STATUSES }, type: sequelize.QueryTypes.SELECT }
  )).map((r) => String(r.id)) : []);
  for (const e of events) {
    let level = null;
    if (e.used_in_episode_id) level = 'committed';
    else if (e.opportunity_id && accepted.has(String(e.opportunity_id))) level = 'confirmed';
    else if (slotted.has(String(e.id))) level = 'planned';
    else if (e.invitation_asset_id) level = 'invited';
    if (level) links[e.id] = { level };
  }
  return links;
}

/** Each event's place for travel: { [eventId]: { venue_id, city, dream } }. A district stands in where no city is known. */
async function placesOf(sequelize, events) {
  const { locationPlace, isDreamCity } = require('../utils/lalaHome');
  const byVenue = new Map();
  const places = {};
  for (const e of events) {
    const venueId = venueIdOf(e);
    if (!venueId) { places[e.id] = { venue_id: null, city: null, dream: false }; continue; }
    if (!byVenue.has(String(venueId))) byVenue.set(String(venueId), await locationPlace(sequelize, venueId));
    const { city, district } = byVenue.get(String(venueId));
    const where = city || district || null;
    places[e.id] = { venue_id: venueId, city: where, dream: Boolean(where) && isDreamCity(where) };
  }
  return places;
}

/** The schedule part: this event against the others that share someone with it. */
async function scheduleOfEvent(models, { showId, event, others }) {
  const { sequelize } = models;
  const lalaProfileId = await require('./lalaFeedProfile').lalaProfileId(sequelize).catch((err) => {
    console.error('[EventFlow] Lala\'s profile could not be read (she is checked by her links only):', err.message);
    return null;
  });
  const all = [event, ...others];
  const lala = await lalaLinks(sequelize, all);
  // Only the events that share someone with this one need a place read.
  const mine = new Set(participantsOf(event, { lala: lala[event.id], lalaProfileId }).map((p) => p.key));
  const sharing = others.filter((o) => participantsOf(o, { lala: lala[o.id], lalaProfileId }).some((p) => mine.has(p.key)));
  const places = await placesOf(sequelize, [event, ...sharing]);
  // The names of this event's people, from their profiles: a host set by its id alone has no name on the event.
  const profileIds = [...mine].filter((k) => k.startsWith('profile:')).map((k) => Number(k.slice('profile:'.length)));
  const names = {};
  if (profileIds.length) {
    const rows = await sequelize.query('SELECT id, display_name, handle FROM social_profiles WHERE id IN (:profileIds)',
      { replacements: { profileIds }, type: sequelize.QueryTypes.SELECT });
    for (const r of rows) names[r.id] = r.display_name || r.handle || undefined;
  }
  const [show] = await sequelize.query('SELECT metadata FROM shows WHERE id = :showId LIMIT 1',
    { replacements: { showId }, type: sequelize.QueryTypes.SELECT });
  const travelMinutes = travelMinutesOf(show?.metadata);
  const result = scheduleCheck({ event, others: sharing, places, lala, lalaProfileId, names, travelMinutes });
  return { ...result, place: places[event.id] || null, travel_minutes: travelMinutes, lala: lala[event.id] || null };
}

/**
 * The flow parts for an event row already read in this show. `loaders`
 * replaces part loaders (tests). Returns { beat14, defaults, clashes, errors? }.
 */
async function loadEventFlow(models, { showId, event, loaders = {} }) {
  let othersP = null;
  const others = () => { othersP = othersP || otherEvents(models.sequelize, { showId, eventId: event.id }); return othersP; };
  const defaults = {
    beat14: () => beat14Preview(models, { showId, event }),
    defaults: async () => smartDefaults({ event, others: await others(), venue: await venueOf(models, event) }),
    clashes: async () => {
      const [rows, affordability] = await Promise.all([
        others(),
        affordabilityOf(models, { showId, event }).catch((err) => {
          console.error('[EventFlow] affordability check failed (left out):', err.message);
          return null;
        }),
      ]);
      return clashes({ event, others: rows, affordability });
    },
    schedule: async () => scheduleOfEvent(models, { showId, event, others: await others() }),
  };
  const settled = await Promise.all(FLOW_PARTS.map(async (part) => {
    try {
      const value = await (loaders[part] || defaults[part])();
      return [part, value ?? null, null];
    } catch (err) {
      console.error(`[EventFlow] ${part} failed:`, err.message);
      return [part, null, err.message || 'Failed to load'];
    }
  }));
  const out = {};
  const errors = {};
  for (const [part, value, error] of settled) {
    out[part] = value;
    if (error) errors[part] = error;
  }
  if (Object.keys(errors).length) out.errors = errors;
  return out;
}

module.exports = { FLOW_PARTS, loadEventFlow, beat14Preview, otherEvents, lalaLinks, placesOf, scheduleOfEvent };

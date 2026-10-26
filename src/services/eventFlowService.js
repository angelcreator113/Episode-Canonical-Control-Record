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
 */

const { smartDefaults, clashes } = require('../utils/eventFlowChecks');

const FLOW_PARTS = Object.freeze(['beat14', 'defaults', 'clashes']);
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

module.exports = { FLOW_PARTS, loadEventFlow, beat14Preview, otherEvents };

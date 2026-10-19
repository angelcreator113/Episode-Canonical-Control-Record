'use strict';

/**
 * The opportunity beat 14 delivers (Evoni, 2026-10-19: "during beat 14 we
 * should include an opportunity invitation from someone at the event, so I
 * need to be able to attach an opportunity to beat 14"; "depend on how the
 * episode went, replace the random follow-up offer").
 *
 * An episode carries at most one, on opportunities.offered_in_episode_id
 * (migration 20261019140000). Who offers it is someone at the episode's
 * event: its host or one of its guests (utils/eventAttendees). Until the
 * episode is completed it waits as status 'held'; at completion it is
 * offered when the episode lands (any tier but fail) and expires when it
 * fails, and the random post-event offer is not made (resolveAtCompletion,
 * called before characterSyncService.generatePostEventOpportunities).
 *
 * Attaching an open opportunity holds it; detaching gives it back its
 * status. One created here, for beat 14, is removed when detached.
 */

const HELD = 'held';
const CREATED_HERE = 'beat14';
const OPEN_STATUSES = ['offered', 'considering', 'negotiating'];
const TYPES = ['modeling', 'runway', 'editorial', 'campaign', 'ambassador', 'brand_deal', 'podcast', 'interview', 'panel', 'award_show', 'pr_gifting', 'casting_call'];

class Beat14Error extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const now = () => new Date().toISOString();
const history = (opp) => (Array.isArray(opp?.status_history) ? opp.status_history : []);

async function episodeAndEvent(models, { showId, episodeId }) {
  const { sequelize } = models;
  const [episode] = await sequelize.query(
    'SELECT id, show_id, title FROM episodes WHERE id = :episodeId AND deleted_at IS NULL',
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  );
  if (!episode || String(episode.show_id) !== String(showId)) throw new Beat14Error(404, 'Episode not found.');
  const { findSourceEvent } = require('./episodeMoneyService');
  return { episode, event: await findSourceEvent(sequelize, episodeId) };
}

/** The event's host and guests as people who can offer: [{ profile_id, handle, name, role }]. */
async function eventPeople(sequelize, event) {
  if (!event) return [];
  const { eventAttendees } = require('../utils/eventAttendees');
  const { eventCreatorOrganizer } = require('../utils/eventOrganizer');
  const ids = [...eventAttendees(event)];
  if (!ids.length) return [];
  const host = Number(eventCreatorOrganizer(event)?.profileId);
  const rows = await sequelize.query(
    `SELECT id, handle, display_name, creator_name FROM social_profiles
      WHERE id IN (:ids) AND deleted_at IS NULL`,
    { replacements: { ids }, type: sequelize.QueryTypes.SELECT }
  );
  return rows
    .map((r) => ({ profile_id: Number(r.id), handle: r.handle || null, name: r.creator_name || r.display_name || r.handle || `Profile ${r.id}`, role: Number(r.id) === host ? 'host' : 'guest' }))
    .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'host' ? -1 : 1));
}

const slim = (o) => (o ? {
  id: o.id, name: o.name, opportunity_type: o.opportunity_type, status: o.status,
  brand_or_company: o.brand_or_company || null, connector_profile_id: o.connector_profile_id ?? null,
  connector_handle: o.connector_handle || null, contact_name: o.contact_name || null,
  narrative_stakes: o.narrative_stakes || null, payment_amount: o.payment_amount != null ? Number(o.payment_amount) : null,
  response_deadline: o.response_deadline || null,
} : null);

async function attached(models, episodeId) {
  return models.Opportunity.findOne({ where: { offered_in_episode_id: episodeId } });
}

/** GET: the attached opportunity, who at the event can offer, and the show's open opportunities to attach. */
async function getBeat14(models, { showId, episodeId }) {
  const { event } = await episodeAndEvent(models, { showId, episodeId });
  const opp = await attached(models, episodeId);
  const { Op } = require('sequelize');
  const open = await models.Opportunity.findAll({
    where: { show_id: showId, status: { [Op.in]: OPEN_STATUSES }, offered_in_episode_id: null },
    order: [['created_at', 'DESC']],
    limit: 50,
  });
  return {
    opportunity: slim(opp),
    people: await eventPeople(models.sequelize, event),
    candidates: open.map(slim),
    event: event ? { id: event.id, name: event.name } : null,
  };
}

async function sender(models, event, profileId) {
  const id = Number(profileId);
  const people = await eventPeople(models.sequelize, event);
  const person = people.find((p) => p.profile_id === id);
  if (!person) throw new Beat14Error(400, 'The invitation comes from someone at the event: choose its host or one of its guests.');
  return person;
}

/**
 * PUT: attach an open opportunity ({ opportunity_id, connector_profile_id })
 * or create one for beat 14 ({ create: { name, opportunity_type, pitch,
 * connector_profile_id } }). The sender must be at the event. Replaces what
 * was attached before.
 */
async function attachBeat14(models, { showId, episodeId, opportunity_id = null, connector_profile_id = null, create = null }) {
  const { episode, event } = await episodeAndEvent(models, { showId, episodeId });
  if (!event) throw new Beat14Error(400, 'This episode has no event, so nobody at an event can offer the opportunity.');
  const person = await sender(models, event, create ? create.connector_profile_id : connector_profile_id);
  const note = `Beat 14 of ${episode.title || 'the episode'}: offered if the episode lands`;
  const sequelize = models.sequelize;
  return sequelize.transaction(async (transaction) => {
    const current = await models.Opportunity.findOne({ where: { offered_in_episode_id: episodeId }, transaction });
    if (current) await release(current, transaction);
    let opp;
    if (create) {
      const name = typeof create.name === 'string' ? create.name.trim().slice(0, 255) : '';
      if (!name) throw new Beat14Error(400, 'Name the opportunity.');
      const type = TYPES.includes(create.opportunity_type) ? create.opportunity_type : 'brand_deal';
      opp = await models.Opportunity.create({
        show_id: showId,
        name,
        opportunity_type: type,
        status: HELD,
        offered_in_episode_id: episodeId,
        connector_profile_id: person.profile_id,
        connector_handle: person.handle,
        contact_name: person.name,
        connection_story: `Met at ${event.name}.`,
        narrative_stakes: typeof create.pitch === 'string' && create.pitch.trim() ? create.pitch.trim().slice(0, 2000) : null,
        status_history: [{ status: HELD, date: now(), note, source: CREATED_HERE, source_episode_id: episodeId }],
      }, { transaction });
    } else {
      opp = await models.Opportunity.findOne({ where: { id: opportunity_id, show_id: showId }, transaction });
      if (!opp) throw new Beat14Error(404, 'Opportunity not found.');
      if (opp.offered_in_episode_id && String(opp.offered_in_episode_id) !== String(episodeId)) throw new Beat14Error(409, 'That opportunity is already beat 14 of another episode.');
      if (!OPEN_STATUSES.includes(opp.status)) throw new Beat14Error(409, `Only an opportunity that is offered, considering or negotiating can be offered in beat 14; this one is ${opp.status}.`);
      await opp.update({
        status: HELD,
        offered_in_episode_id: episodeId,
        connector_profile_id: person.profile_id,
        connector_handle: person.handle,
        contact_name: opp.contact_name || person.name,
        connection_story: opp.connection_story || `Met at ${event.name}.`,
        status_history: [...history(opp), { status: HELD, date: now(), note, previous_status: opp.status, source_episode_id: episodeId }],
      }, { transaction });
    }
    return slim(opp);
  });
}

// An attached opportunity let go: one made for beat 14 is removed; another
// gets back the status it had.
async function release(opp, transaction) {
  const createdHere = history(opp).some((h) => h?.source === CREATED_HERE);
  if (createdHere) {
    await opp.update({ offered_in_episode_id: null }, { transaction });
    await opp.destroy({ transaction });
    return;
  }
  const held = [...history(opp)].reverse().find((h) => h?.status === HELD && h.previous_status);
  const back = held?.previous_status || 'offered';
  await opp.update({
    status: back,
    offered_in_episode_id: null,
    status_history: [...history(opp), { status: back, date: now(), note: 'No longer beat 14 of the episode' }],
  }, { transaction });
}

/** DELETE: nothing attached any more. */
async function detachBeat14(models, { showId, episodeId }) {
  await episodeAndEvent(models, { showId, episodeId });
  await models.sequelize.transaction(async (transaction) => {
    const opp = await models.Opportunity.findOne({ where: { offered_in_episode_id: episodeId }, transaction });
    if (opp) await release(opp, transaction);
  });
  return { opportunity: null };
}

/**
 * At completion, before the random post-event offer: the attached
 * opportunity is offered when the episode lands and expires when it fails.
 * Returns { id, name, status } or null when nothing is attached (the random
 * offer is then made as before). Its history carries source_event_id, the
 * post-event marker (characterSyncService.postEventOpportunitiesExist), so
 * no random offer follows later either.
 */
async function resolveAtCompletion(models, { episodeId, event, tierFinal }) {
  if (!models?.Opportunity) return null;
  const opp = await models.Opportunity.findOne({ where: { offered_in_episode_id: episodeId } });
  if (!opp || opp.status !== HELD) return opp ? { id: opp.id, name: opp.name, status: opp.status } : null;
  const landed = tierFinal !== 'fail';
  const status = landed ? 'offered' : 'expired';
  const today = new Date().toISOString().slice(0, 10);
  await opp.update({
    status,
    ...(landed ? { offer_date: today } : {}),
    status_history: [...history(opp), {
      status, date: now(), tier: tierFinal || null, source_event_id: event?.id || null,
      note: landed ? `From event: ${event?.name || 'the event'} (beat 14)` : 'The episode did not land; the offer never came',
    }],
  });
  return { id: opp.id, name: opp.name, status };
}

/** What the writer reads: the attached opportunity and its sender's name, or null. */
async function loadForScript(models, { episodeId }) {
  if (!models?.Opportunity) return null;
  const opp = await models.Opportunity.findOne({ where: { offered_in_episode_id: episodeId } });
  return slim(opp);
}

module.exports = { getBeat14, attachBeat14, detachBeat14, resolveAtCompletion, loadForScript, eventPeople, Beat14Error, HELD, TYPES };

const { beat14Outcome } = require('../utils/beat14Invitation');

/**
 * The writer's BEAT 14 OPPORTUNITY block for the attached opportunity, ''
 * without one. Whether it comes depends on how the episode goes (Evoni,
 * 2026-10-19): an episode designed to fail does not deliver it. Once the
 * episode is completed its status says what happened, expired or offered
 * (utils/beat14Invitation beat14Outcome; Script page audit, 2026-10-19).
 */
function beat14Context(opp, designedIntent = null) {
  if (!opp) return '';
  const outcome = beat14Outcome(opp, designedIntent);
  const from = opp.contact_name || (opp.connector_handle ? `@${opp.connector_handle}` : 'someone at the event');
  const handle = opp.connector_handle && opp.contact_name ? ` (@${opp.connector_handle})` : '';
  const lines = [
    '═══ BEAT 14 OPPORTUNITY ═══',
    `${opp.name}${opp.brand_or_company ? `, with ${opp.brand_or_company}` : ''} (${String(opp.opportunity_type || 'opportunity').replace(/_/g, ' ')}): offered by ${from}${handle}, who was at the event.`,
  ];
  if (opp.narrative_stakes) lines.push(`What it is about: ${opp.narrative_stakes}`);
  if (outcome === 'withheld') {
    const why = opp.status === 'expired' ? 'This episode did not land' : 'This episode is designed not to land';
    lines.push(`${why}, so the invitation does not come: Beat 14 never delivers it, no other offer comes in its place, and its question is what she does now.`);
  } else {
    lines.push(`Beat 14 ends on it: the invitation arrives from ${from} as one private message or notification ([UI:DM ${from}: …] or [UI:NOTIFY ${from}: …]), naming "${opp.name}" in their own voice. How warm it is follows how the episode went. Whether Lala says yes stays open. When a forward hook is set, this invitation is how it is told. What it pays is never a coin line.`);
  }
  return `\n${lines.join('\n')}\n`;
}

module.exports.beat14Context = beat14Context;
module.exports.beat14Outcome = beat14Outcome;

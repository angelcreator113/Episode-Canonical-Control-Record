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
 *
 * Once completion has offered or expired it, beat 14 is final (Script page
 * audit, 2026-10-19: detaching or replacing it then deleted an offered
 * opportunity or rolled back an accepted one, and one attached after
 * completion stayed held for good): attach and detach answer 409 when the
 * attached opportunity is no longer held, and attach answers 409 for a
 * completed episode (episodes.evaluation_status 'accepted', as
 * episodeCompletionService records it).
 *
 * A held one is never stuck (Evoni, 2026-10-23): completion without a
 * recorded tier offers it, and the show tab can release it by hand
 * (releaseHeld) or schedule it as an event before its episode is completed
 * (feedEventPipelineService.scheduleOpportunityAsEvent), both offering it
 * first. Beat 14 is then final for it, as after completion.
 */

const HELD = 'held';
const CREATED_HERE = 'beat14';
const OPEN_STATUSES = ['offered', 'considering', 'negotiating'];
const TYPES = ['modeling', 'runway', 'editorial', 'campaign', 'ambassador', 'brand_deal', 'podcast', 'interview', 'panel', 'award_show', 'pr_gifting', 'casting_call'];

class Beat14Error extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const history = (opp) => (Array.isArray(opp?.status_history) ? opp.status_history : []);

async function episodeAndEvent(models, { showId, episodeId }) {
  const { sequelize } = models;
  const [episode] = await sequelize.query(
    'SELECT id, show_id, title, evaluation_status, evaluation_json FROM episodes WHERE id = :episodeId AND deleted_at IS NULL',
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

// `completion_status`: what completion decided, 'offered' or 'expired'
// (utils/beat14Invitation beat14Decided), so the writer and the Script tab
// read it whatever the status became later (Script page audit 3,
// 2026-10-19: an expired one archived read as offered).
const slim = (o) => (o ? {
  id: o.id, name: o.name, opportunity_type: o.opportunity_type, status: o.status,
  brand_or_company: o.brand_or_company || null, connector_profile_id: o.connector_profile_id ?? null,
  connector_handle: o.connector_handle || null, contact_name: o.contact_name || null,
  narrative_stakes: o.narrative_stakes || null, payment_amount: o.payment_amount != null ? Number(o.payment_amount) : null,
  response_deadline: o.response_deadline || null,
  completion_status: require('../utils/beat14Invitation').beat14Decided(o),
  // Offered by hand from the show tab (releaseHeld, or scheduled early), not by completion.
  released: wasReleased(o),
} : null);

const isCompleted = (episode) => episode?.evaluation_status === 'accepted';

// The attached opportunity can still change only while it is held. An
// episode whose evaluation was reset after completion (show reset, a new
// Evaluate) no longer reads as completed, but what completion did to its
// beat 14 stands, and the message says so (Script page re-audit, 2026-10-19:
// it said "The episode is completed" of an episode that was not).
function assertStillHeld(opp, episode = null) {
  if (opp && opp.status !== HELD) {
    if (wasReleased(opp)) {
      throw new Beat14Error(409, "Its beat 14 opportunity was already offered by hand (released, or scheduled before the episode was completed), so it can't be changed or removed here.");
    }
    const what = opp.status === 'expired' ? 'expired' : 'offered';
    throw new Beat14Error(409, episode && !isCompleted(episode)
      ? `Its beat 14 opportunity was already ${what} when the episode was completed (its evaluation has been reset since), so it can't be changed or removed here.`
      : `The episode is completed: its beat 14 opportunity was already ${what}, so it can't be changed or removed here.`);
  }
}

// The tier completion recorded (episodes.evaluation_json.tier_final), or null.
function completedTier(episode) {
  let ev = episode?.evaluation_json;
  if (typeof ev === 'string') {
    try { ev = JSON.parse(ev); } catch (err) { console.error('[Beat14] evaluation_json is not valid JSON:', err.message); ev = null; }
  }
  return ev?.tier_final || null;
}

async function attached(models, episodeId) {
  return models.Opportunity.findOne({ where: { offered_in_episode_id: episodeId } });
}

const plain = (o) => (o && typeof o.get === 'function' ? o.get({ plain: true }) : o);

/**
 * What beat14Fit scores against (Evoni, 2026-10-25): the brands of the
 * event's host and guests, the active goals nothing in the season moves yet,
 * and Lala's stats. The host's brand is the event's opportunity's company,
 * else the company named host_brand, else host_brand as a name
 * (dealTermsDraftService brandProfileIdFor reads it the same way); a
 * person's is the company their Pulse account belongs to
 * (full_profile.lalaverse_brand_id). A failed read leaves that part out:
 * the candidates are then listed with fewer reasons, never refused.
 */
async function fitContext(models, { showId, event, people }) {
  const { sequelize } = models;
  const ctx = { event, brands: [], goals: [], state: {} };
  if (!event) return ctx;
  const select = (sql, replacements) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
  try {
    let cc = event.canon_consequences;
    if (typeof cc === 'string') {
      try { cc = JSON.parse(cc); } catch (err) { console.error('[Beat14] canon_consequences is not valid JSON:', err.message); cc = null; }
    }
    const hostBrand = String(event.host_brand || cc?.automation?.host_brand || '').trim();
    let hostCompany = null;
    if (event.opportunity_id) {
      hostCompany = (await select('SELECT company_id FROM opportunities WHERE id = :id AND deleted_at IS NULL', { id: event.opportunity_id }))?.[0]?.company_id || null;
    }
    if (!hostCompany && hostBrand) {
      hostCompany = (await select('SELECT id FROM lalaverse_brands WHERE deleted_at IS NULL AND LOWER(TRIM(name)) = LOWER(:brand) ORDER BY created_at ASC LIMIT 1', { brand: hostBrand }))?.[0]?.id || null;
    }
    const host = people.find((p) => p.role === 'host');
    if (hostCompany || hostBrand) ctx.brands.push({ company_id: hostCompany, name: hostBrand || null, role: 'host', person: host?.name || null });
    const ids = people.map((p) => p.profile_id);
    if (ids.length) {
      const rows = await select(
        `SELECT sp.id, b.id AS company_id, b.name FROM social_profiles sp
           JOIN lalaverse_brands b ON b.id::text = sp.full_profile->>'lalaverse_brand_id' AND b.deleted_at IS NULL
          WHERE sp.id IN (:ids) AND sp.deleted_at IS NULL`, { ids });
      for (const r of Array.isArray(rows) ? rows : []) {
        const person = people.find((p) => p.profile_id === Number(r.id));
        if (person) ctx.brands.push({ company_id: r.company_id, name: r.name, role: person.role, person: person.name });
      }
    }
    // The host's own brand first, so "Same brand as the host" wins a tie.
    ctx.brands.sort((a, b) => (a.role === b.role ? 0 : a.role === 'host' ? -1 : 1));
  } catch (err) {
    console.error('[Beat14] the event\'s brands could not be read (ranked without them):', err.message);
  }
  try {
    const { loadCoverageInputs, computeCoverage } = require('./seasonGoalCoverage');
    const inputs = await loadCoverageInputs(sequelize, showId);
    if (inputs) {
      const coverage = computeCoverage(inputs);
      const uncovered = new Set(coverage.goals.filter((g) => !g.movers.length).map((g) => String(g.id)));
      ctx.goals = inputs.goals.filter((g) => uncovered.has(String(g.id)));
      ctx.state = inputs.state || {};
    }
  } catch (err) {
    console.error('[Beat14] the season\'s goals could not be read (ranked without them):', err.message);
  }
  return ctx;
}

/** GET: the attached opportunity, who at the event can offer, and the show's open opportunities to attach, best fits first (beat14Fit). */
async function getBeat14(models, { showId, episodeId }) {
  const { event } = await episodeAndEvent(models, { showId, episodeId });
  // A read writes nothing (Script page audit 3, 2026-10-19: it resolved a
  // held one on a completed episode, unlocked, so two reads or a read and a
  // completion each wrote it). One completion could not resolve stays held
  // until the episode's Complete is called again, which resolves it
  // (resolveHeldAfterCompletion).
  const opp = await attached(models, episodeId);
  const { Op } = require('sequelize');
  const open = await models.Opportunity.findAll({
    where: { show_id: showId, status: { [Op.in]: OPEN_STATUSES }, offered_in_episode_id: null },
    order: [['created_at', 'DESC']],
    limit: 50,
  });
  const people = await eventPeople(models.sequelize, event);
  const { rankCandidates, scoreCandidate } = require('./beat14Fit');
  const ctx = await fitContext(models, { showId, event, people });
  return {
    opportunity: opp ? { ...slim(opp), fit: scoreCandidate(plain(opp), ctx) } : null,
    people,
    candidates: rankCandidates(open.map(plain), ctx).map((c) => ({ ...slim(c), fit: c.fit })),
    event: event ? { id: event.id, name: event.name } : null,
  };
}

/**
 * GET …/beat14/suggest (Evoni, 2026-10-25): a new opportunity drafted from
 * someone at the event — `from` (a profile id) when given, else the host,
 * else the first guest — moving the first goal nothing in the season moves
 * yet. Deterministic, no AI. Nothing is saved: the draft fills beat 14's
 * create form, and only its Attach saves it (attachBeat14 with `create`).
 * Returns { draft, people }; draft is null when nobody at the event can
 * offer it.
 */
async function suggestBeat14(models, { showId, episodeId, from = null }) {
  const { event } = await episodeAndEvent(models, { showId, episodeId });
  if (!event) throw new Beat14Error(400, 'This episode has no event, so nobody at an event can offer the opportunity.');
  const people = await eventPeople(models.sequelize, event);
  let person = people[0] || null;
  if (from != null && from !== '') {
    person = people.find((p) => p.profile_id === Number(from)) || null;
    if (!person) throw new Beat14Error(400, 'The invitation comes from someone at the event: choose its host or one of its guests.');
  }
  if (!person) return { draft: null, people };
  const ctx = await fitContext(models, { showId, event, people });
  const brand = ctx.brands.find((b) => b.person === person.name && (b.role === person.role))?.name
    || (person.role === 'host' ? ctx.brands.find((b) => b.role === 'host')?.name : null)
    || null;
  const goal = ctx.goals.find((g) => g.target_metric !== 'stress') || null;
  const { draftSuggestion } = require('./beat14Fit');
  const draft = draftSuggestion({ event, person, brand, goal });
  return { draft: draft ? { ...draft, goal: goal ? { id: goal.id, title: goal.title } : null } : null, people };
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
  if (isCompleted(episode)) throw new Beat14Error(409, 'The episode is completed: its beat 14 opportunity was already offered or expired, so nothing can be attached now.');
  const person = await sender(models, event, create ? create.connector_profile_id : connector_profile_id);
  const note = `Beat 14 of ${episode.title || 'the episode'}: offered if the episode lands`;
  const sequelize = models.sequelize;
  return sequelize.transaction(async (transaction) => {
    // Completion locks the episode row and marks it accepted under the lock;
    // read again here under the same lock, so an attach that raced a
    // completion is refused rather than left held on a completed episode
    // (Script page re-audit, 2026-10-19).
    const [locked] = await sequelize.query(
      'SELECT evaluation_status FROM episodes WHERE id = :episodeId FOR UPDATE',
      { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT, transaction }
    );
    if (isCompleted(locked)) throw new Beat14Error(409, 'The episode is completed: its beat 14 opportunity was already offered or expired, so nothing can be attached now.');
    const current = await models.Opportunity.findOne({ where: { offered_in_episode_id: episodeId }, transaction });
    assertStillHeld(current, episode);
    // The card's Change on what is already attached: only who offers it
    // changes. Releasing first would remove one made here (Script page
    // audit, 2026-10-19).
    if (current && !create && String(current.id) === String(opportunity_id)) {
      await current.update({
        connector_profile_id: person.profile_id,
        connector_handle: person.handle,
        contact_name: person.name,
      }, { transaction });
      return slim(current);
    }
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
      // The invitation is from the person picked (Script tab audit 6,
      // 2026-10-24: contact_name kept the one it had, so the writer named
      // someone else). What it had before is kept in the history entry, and
      // release() gives it back.
      const previous = {
        connector_profile_id: opp.connector_profile_id ?? null,
        connector_handle: opp.connector_handle ?? null,
        contact_name: opp.contact_name ?? null,
        connection_story: opp.connection_story ?? null,
      };
      await opp.update({
        status: HELD,
        offered_in_episode_id: episodeId,
        connector_profile_id: person.profile_id,
        connector_handle: person.handle,
        contact_name: person.name,
        connection_story: opp.connection_story || `Met at ${event.name}.`,
        status_history: [...history(opp), { status: HELD, date: now(), note, previous_status: opp.status, previous, source_episode_id: episodeId }],
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
  // Who it was from before beat 14 (attachBeat14 keeps it in the entry).
  const prev = held?.previous && typeof held.previous === 'object' ? held.previous : null;
  await opp.update({
    status: back,
    offered_in_episode_id: null,
    ...(prev ? {
      connector_profile_id: prev.connector_profile_id ?? null,
      connector_handle: prev.connector_handle ?? null,
      contact_name: prev.contact_name ?? null,
      connection_story: prev.connection_story ?? null,
    } : {}),
    status_history: [...history(opp), { status: back, date: now(), note: 'No longer beat 14 of the episode' }],
  }, { transaction });
}

/** DELETE: nothing attached any more. */
async function detachBeat14(models, { showId, episodeId }) {
  const { episode } = await episodeAndEvent(models, { showId, episodeId });
  const { sequelize } = models;
  await sequelize.transaction(async (transaction) => {
    // Under the episode's lock, as attach reads it (Script page audit 3,
    // 2026-10-19): completion marks the episode accepted under this lock
    // and resolves beat 14 after it commits, so a detach in between let
    // the opportunity go and a random offer was made in its place.
    const [locked] = await sequelize.query(
      'SELECT evaluation_status FROM episodes WHERE id = :episodeId FOR UPDATE',
      { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT, transaction }
    );
    const opp = await models.Opportunity.findOne({ where: { offered_in_episode_id: episodeId }, transaction });
    assertStillHeld(opp, episode);
    if (opp && isCompleted(locked)) throw new Beat14Error(409, "The episode is completed: completion offers or expires its beat 14 opportunity, so it can't be removed now.");
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
  // No recorded tier counts as landed (Evoni, 2026-10-23: one completed
  // without its tier stayed held for good, and nothing could free it).
  const landed = tierFinal !== 'fail';
  const status = landed ? 'offered' : 'expired';
  const note = !landed ? 'The episode did not land; the offer never came'
    : tierFinal ? `From event: ${event?.name || 'the event'} (beat 14)`
      : 'Completed without a recorded tier; offered';
  await opp.update({
    status,
    ...(landed ? { offer_date: today() } : {}),
    status_history: [...history(opp), {
      status, date: now(), tier: tierFinal || null, source_event_id: event?.id || null, note,
    }],
  });
  return { id: opp.id, name: opp.name, status };
}

/**
 * After completion, for one whose resolve failed (Script page re-audit,
 * 2026-10-19): an episode completed with its beat 14 opportunity still held
 * gets it offered or expired by the tier completion recorded (offered
 * when none was recorded). Returns what
 * resolveAtCompletion returns, or null when there is nothing to do.
 * Completion calls it when it finds the episode already completed.
 */
async function resolveHeldAfterCompletion(models, { episodeId }) {
  if (!models?.Opportunity || !models?.sequelize) return null;
  const opp = await attached(models, episodeId);
  if (!opp || opp.status !== HELD) return null;
  const { sequelize } = models;
  const [episode] = await sequelize.query(
    'SELECT id, evaluation_status, evaluation_json FROM episodes WHERE id = :episodeId AND deleted_at IS NULL',
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  );
  // Without a recorded tier it is offered, as if the episode landed
  // (resolveAtCompletion; Evoni, 2026-10-23: it stayed held for good).
  if (!isCompleted(episode)) return null;
  const { findSourceEvent } = require('./episodeMoneyService');
  const event = await findSourceEvent(sequelize, episodeId);
  return resolveAtCompletion(models, { episodeId, event, tierFinal: completedTier(episode) });
}

/**
 * Released by hand (Evoni, 2026-10-23: "I currently have an opportunity
 * from episode 1 in the opportunities tab but I can't turn it into an
 * event"): a held one is offered now, without waiting for its episode's
 * result. It keeps offered_in_episode_id, so that episode's beat 14 still
 * delivers it as the invitation. The history entry carries `tier` (null),
 * so utils/beat14Invitation beat14Decided reads it as offered whatever its
 * status becomes later, and source_event_id, the post-event marker
 * (characterSyncService.postEventOpportunitiesExist). A later completion
 * finds it no longer held and leaves it as it is, and makes no random
 * post-event offer beside it (resolveAtCompletion returns it).
 */
function releasedEntry({ note, eventId = null, episodeId = null }) {
  return { status: 'offered', date: now(), note, tier: null, released: true, source_event_id: eventId, source_episode_id: episodeId };
}
const wasReleased = (opp) => history(opp).some((h) => h?.released === true);

async function episodeEventId(sequelize, episodeId) {
  if (!episodeId) return null;
  const { findSourceEvent } = require('./episodeMoneyService');
  return (await findSourceEvent(sequelize, episodeId))?.id || null;
}

/** POST …/:id/release: held → offered. 409 when it is not held. */
async function releaseHeld(models, { showId, id }) {
  const { sequelize } = models;
  return sequelize.transaction(async (transaction) => {
    // Under the opportunity's lock, so two releases, or a release and a
    // schedule, write it once.
    const opp = await models.Opportunity.findOne({ where: { id, show_id: showId }, transaction, lock: transaction.LOCK?.UPDATE ?? true });
    if (!opp) throw new Beat14Error(404, 'Opportunity not found.');
    if (opp.status !== HELD) throw new Beat14Error(409, `Only one held for beat 14 can be released; this one is ${opp.status}.`);
    const eventId = await episodeEventId(sequelize, opp.offered_in_episode_id);
    await opp.update({
      status: 'offered',
      offer_date: today(),
      status_history: [...history(opp), releasedEntry({ note: 'Released by hand', eventId, episodeId: opp.offered_in_episode_id })],
    }, { transaction });
    return opp;
  });
}

/** What the writer reads: the attached opportunity and its sender's name, or null. */
async function loadForScript(models, { episodeId }) {
  if (!models?.Opportunity) return null;
  const opp = await models.Opportunity.findOne({ where: { offered_in_episode_id: episodeId } });
  return slim(opp);
}

module.exports = { getBeat14, suggestBeat14, fitContext, attachBeat14, detachBeat14, resolveAtCompletion, resolveHeldAfterCompletion, releaseHeld, releasedEntry, episodeEventId, loadForScript, eventPeople, Beat14Error, HELD, TYPES };

const { beat14Outcome, beat14Decided } = require('../utils/beat14Invitation');

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
    const why = beat14Decided(opp) === 'expired' || opp.status === 'expired' ? 'This episode did not land' : 'This episode is designed not to land';
    lines.push(`${why}, so the invitation does not come: Beat 14 never delivers it, no other offer comes in its place, and its question is what she does now.`);
  } else {
    lines.push(`Beat 14 ends on it: the invitation arrives from ${from} as one private message or notification ([UI:DM ${from}: …] or [UI:NOTIFY ${from}: …]), naming "${opp.name}" in their own voice. How warm it is follows how the episode went. Whether Lala says yes stays open. When a forward hook is set, this invitation is how it is told. What it pays is never a coin line.`);
  }
  return `\n${lines.join('\n')}\n`;
}

module.exports.beat14Context = beat14Context;
module.exports.beat14Outcome = beat14Outcome;

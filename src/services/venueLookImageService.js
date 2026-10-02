/**
 * "Generate this look": an event's Venue Look made into an image on its
 * venue's scene set (Evoni's rulings L7-L9, 2026-10-02, and her answers
 * 1-4 and 6; docs/EVENT_EPISODE_FLOW.md §8(hh)).
 *
 *   L7. "The Place section has one-click 'Generate this look', with its
 *   cost shown first (S2). It uses the event's venue scene set, creating
 *   one for the venue if there is none, and its image is made on the Scene
 *   Sets page's set, not a separate copy."
 *   L8. "If the venue has no approved base, 'Generate this look' makes the
 *   base only (the empty room, no event dressing) and stops; the base waits
 *   for Evoni's approval in Scene Sets. Once a base is approved, 'Generate
 *   this look' makes the event-dressed version from the Event Venue Look
 *   (S6, Kontext)."
 *
 * The set (answer 3): the event's chosen set; else the venue's sets by
 * F3's rule (one is used, several ask Evoni to choose); none, one is
 * created for the venue and linked to the event.
 *
 * The step (answer 4), from the venue's approval:
 *   look               the venue has an approved base: an edit of it with
 *                      the event layer (Kontext), stored as the event's
 *                      look in scene_set_looks, never as the set's base
 *                      (answers 1, 2)
 *   base               no approved base and the set has no base image: the
 *                      empty-room base, no event dressing; it then waits
 *                      for approval
 *   awaiting_approval  no approved base, and the set's base is waiting for
 *                      approval: nothing is generated
 */

const { buildSceneBrief, briefToPrompt, loadBriefLocation, loadBriefEvent, readBriefOverrides } = require('./sceneBriefService');
const { venueLocationId, venueDraftSet } = require('./venueGenerationService');

const STEPS = Object.freeze({ LOOK: 'look', BASE: 'base', AWAITING_APPROVAL: 'awaiting_approval' });

class VenueLookImageError extends Error {
  constructor(message, status = 400, code = 'LOOK_IMAGE_INVALID', extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    Object.assign(this, extra);
  }
}

async function loadEvent(sequelize, { showId, eventId }) {
  const [[event]] = await sequelize.query(
    `SELECT id, show_id, name, scene_set_id, venue_location_id, venue_name, canon_consequences
       FROM world_events WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL`,
    { replacements: { eventId, showId } });
  if (!event) throw new VenueLookImageError('Event not found', 404, 'EVENT_NOT_FOUND');
  return event;
}

async function liveSet(sequelize, id) {
  if (!id) return null;
  const [[set]] = await sequelize.query(
    `SELECT id, name, show_id, scene_type, world_location_id, base_still_url, base_model, generation_status,
            canonical_description, visual_language, time_of_day, season, style_reference_url
       FROM scene_sets WHERE id = :id AND deleted_at IS NULL`,
    { replacements: { id } });
  return set || null;
}

async function venueSets(sequelize, locationId) {
  if (!locationId) return [];
  const [rows] = await sequelize.query(
    `SELECT id, name, base_still_url FROM scene_sets
      WHERE world_location_id = :locationId AND deleted_at IS NULL
      ORDER BY name ASC, created_at ASC`,
    { replacements: { locationId } });
  return rows;
}

/**
 * The set the look is made on (answer 3):
 *   { kind: 'set', set, link }       link: the event is not linked to it yet
 *   { kind: 'choose', options }      several sets at the venue
 *   { kind: 'create', locationId }   none at the venue: one will be made
 */
async function resolveLookSet(sequelize, event, chosenSetId = null) {
  const venueId = venueLocationId(event);
  const own = await liveSet(sequelize, event.scene_set_id);
  if (own) return { kind: 'set', set: own, link: false };
  const sets = await venueSets(sequelize, venueId);
  if (chosenSetId) {
    const chosen = sets.find((s) => String(s.id) === String(chosenSetId));
    if (!chosen) throw new VenueLookImageError('That scene set is not at this event\'s venue', 400, 'SET_NOT_AT_VENUE');
    return { kind: 'set', set: await liveSet(sequelize, chosen.id), link: true };
  }
  if (sets.length === 1) return { kind: 'set', set: await liveSet(sequelize, sets[0].id), link: true };
  if (sets.length > 1) return { kind: 'choose', options: sets.map((s) => ({ id: s.id, name: s.name, base_still_url: s.base_still_url || null })) };
  if (!venueId) throw new VenueLookImageError('Choose a venue for the event first', 400, 'NO_VENUE');
  return { kind: 'create', locationId: venueId };
}

async function loadLocation(sequelize, id) {
  if (!id) return null;
  const [[loc]] = await sequelize.query(
    `SELECT id, name, description, approved_base_scene_set_id, approved_base_image_url
       FROM world_locations WHERE id = :id AND deleted_at IS NULL`,
    { replacements: { id } });
  return loc || null;
}

/**
 * The step and its brief and estimate, read only (S2's cost first).
 * set: a saved set, or the unsaved draft of the one that would be made.
 */
async function planLook(sequelize, { event, set, overrides = {} }) {
  const sceneGen = require('./sceneGenerationService');
  const locationId = set.world_location_id || venueLocationId(event);
  const location = await loadBriefLocation(sequelize, locationId);
  if (location?.approved_base_image_url) {
    const briefEvent = await loadBriefEvent(sequelize, event.id, null);
    const brief = buildSceneBrief({ sceneSet: set, location, event: briefEvent, angleLabel: 'WIDE', overrides, lookDressing: true });
    return {
      step: STEPS.LOOK,
      brief,
      estimate: { ...sceneGen.estimateDressingCost(), base_model: sceneGen.SCENE_DRESSING_MODEL.key },
    };
  }
  if (set.id && set.base_still_url) return { step: STEPS.AWAITING_APPROVAL, brief: null, estimate: null };
  const brief = buildSceneBrief({ sceneSet: set, location, event: null, angleLabel: 'WIDE', overrides });
  const modelKey = sceneGen.resolveBaseModel(set);
  return { step: STEPS.BASE, brief, estimate: { ...sceneGen.estimateBaseStillCost(modelKey), base_model: modelKey } };
}

/** The look brief for the Place section's confirm (no side effects). */
async function lookBrief(sequelize, { showId, eventId, chosenSetId = null, overrides: rawOverrides }) {
  const overrides = readBriefOverrides(rawOverrides);
  if (overrides.error) throw new VenueLookImageError(overrides.error);
  const event = await loadEvent(sequelize, { showId, eventId });
  const target = await resolveLookSet(sequelize, event, chosenSetId);
  if (target.kind === 'choose') return { step: 'choose', options: target.options };
  const set = target.kind === 'set'
    ? target.set
    : { ...venueDraftSet(event, await loadLocation(sequelize, target.locationId)), show_id: event.show_id };
  const plan = await planLook(sequelize, { event, set, overrides: overrides.value || {} });
  return {
    step: plan.step,
    scene_set: set.id ? { id: set.id, name: set.name } : null,
    creates_set: target.kind === 'create' ? { name: set.name } : null,
    brief: plan.brief,
    estimate: plan.estimate,
  };
}

async function createVenueSet(models, event, locationId) {
  const location = await loadLocation(models.sequelize, locationId);
  const draft = venueDraftSet(event, location);
  const created = await models.SceneSet.create({
    name: draft.name,
    scene_type: 'EVENT_LOCATION',
    show_id: event.show_id,
    world_location_id: locationId,
    canonical_description: draft.canonical_description,
  });
  return liveSet(models.sequelize, created.id);
}

async function linkEvent(sequelize, eventId, setId) {
  await sequelize.query('UPDATE world_events SET scene_set_id = :setId, updated_at = NOW() WHERE id = :eventId',
    { replacements: { setId, eventId } });
}

/**
 * "Generate this look" after the cost was confirmed. Returns { result, run }:
 * result is what the route answers now; run() does the paid work after it.
 */
async function startLook(models, { showId, eventId, chosenSetId = null, overrides: rawOverrides }) {
  const { sequelize } = models;
  const overrides = readBriefOverrides(rawOverrides);
  if (overrides.error) throw new VenueLookImageError(overrides.error);
  const event = await loadEvent(sequelize, { showId, eventId });
  const target = await resolveLookSet(sequelize, event, chosenSetId);
  if (target.kind === 'choose') {
    throw new VenueLookImageError('This venue has several scene sets: choose one', 409, 'CHOOSE_SET', { options: target.options });
  }
  const set = target.kind === 'create' ? await createVenueSet(models, event, target.locationId) : target.set;
  if (target.kind === 'create' || target.link) await linkEvent(sequelize, event.id, set.id);

  const plan = await planLook(sequelize, { event, set, overrides: overrides.value || {} });
  const sceneGen = require('./sceneGenerationService');

  if (plan.step === STEPS.AWAITING_APPROVAL) {
    return { result: { step: plan.step, scene_set_id: set.id }, run: null };
  }

  if (plan.step === STEPS.BASE) {
    const { missingProviderKeys } = require('./sceneModelComparisonService');
    const missing = missingProviderKeys([plan.estimate.base_model]);
    if (missing.length) throw new VenueLookImageError(`Base model ${plan.estimate.base_model} needs ${missing.join(', ')}, which is not configured.`, 503, 'PROVIDER_NOT_CONFIGURED');
    await models.SceneSet.update({ generation_status: 'generating' }, { where: { id: set.id } });
    const run = async () => {
      const instance = await models.SceneSet.findByPk(set.id);
      try {
        // L8: the empty room, no event dressing.
        await sceneGen.generateBaseScene(instance, models, { eventId: null, overrides: overrides.value || {} });
      } catch (err) {
        console.error(`[VenueLookImage] base for "${set.name}" failed:`, err.message);
        await models.SceneSet.update({ generation_status: 'failed' }, { where: { id: set.id } });
      }
    };
    return { result: { step: plan.step, scene_set_id: set.id }, run };
  }

  if (!process.env.FAL_KEY) throw new VenueLookImageError('A look uses Flux Kontext, which needs FAL_KEY, which is not configured.', 503, 'PROVIDER_NOT_CONFIGURED');
  const [[look]] = await sequelize.query(
    `INSERT INTO scene_set_looks (id, scene_set_id, event_id, status, brief, estimate_usd, error, created_at, updated_at)
     VALUES (gen_random_uuid(), :setId, :eventId, 'generating', CAST(:brief AS jsonb), :estimate, NULL, NOW(), NOW())
     ON CONFLICT (scene_set_id, event_id) WHERE deleted_at IS NULL
     DO UPDATE SET status = 'generating', brief = EXCLUDED.brief, estimate_usd = EXCLUDED.estimate_usd, error = NULL, updated_at = NOW()
     RETURNING id`,
    { replacements: { setId: set.id, eventId: event.id, brief: JSON.stringify(plan.brief), estimate: plan.estimate?.usd ?? null } });
  const run = async () => {
    try {
      const out = await sceneGen.generateDressedStill(set, briefToPrompt(plan.brief), plan.brief.approved_base.image_url, { suffix: `look-${event.id}` });
      await sequelize.query(
        `UPDATE scene_set_looks SET status = 'complete', image_url = :url, cost_usd = :cost, generated_at = NOW(), updated_at = NOW()
          WHERE id = :id`,
        { replacements: { id: look.id, url: out.stillUrl, cost: out.cost } });
    } catch (err) {
      console.error(`[VenueLookImage] look for event ${event.id} on "${set.name}" failed:`, err.message);
      await sequelize.query(
        `UPDATE scene_set_looks SET status = 'failed', error = :error, updated_at = NOW() WHERE id = :id`,
        { replacements: { id: look.id, error: String(err.message || err).slice(0, 500) } });
    }
  };
  return { result: { step: plan.step, scene_set_id: set.id, look_id: look.id }, run };
}

/**
 * The event's look as the Place section shows it (L9): the set, the
 * venue's approval, and the event's look; read only.
 */
async function eventLook(sequelize, { showId, eventId }) {
  const event = await loadEvent(sequelize, { showId, eventId });
  const set = await liveSet(sequelize, event.scene_set_id);
  if (!set) return { scene_set: null, look: null, approved_base: null };
  const location = await loadLocation(sequelize, set.world_location_id);
  const [[look]] = await sequelize.query(
    `SELECT id, status, image_url, error, generated_at, updated_at FROM scene_set_looks
      WHERE scene_set_id = :setId AND event_id = :eventId AND deleted_at IS NULL`,
    { replacements: { setId: set.id, eventId: event.id } });
  return {
    scene_set: {
      id: set.id, name: set.name, base_still_url: set.base_still_url || null, generation_status: set.generation_status || null,
    },
    approved_base: location?.approved_base_image_url
      ? { scene_set_id: location.approved_base_scene_set_id, image_url: location.approved_base_image_url }
      : null,
    look: look || null,
  };
}

/** Each set's looks with their event (L9): Map setId -> [{ ... }], newest first. */
async function looksForSets(sequelize, setIds) {
  const ids = [...new Set((setIds || []).filter(Boolean))];
  const bySet = new Map();
  if (!ids.length) return bySet;
  const [rows] = await sequelize.query(
    `SELECT l.id, l.scene_set_id, l.event_id, l.status, l.image_url, l.generated_at,
            e.name AS event_name, e.show_id AS event_show_id
       FROM scene_set_looks l JOIN world_events e ON e.id = l.event_id AND e.deleted_at IS NULL
      WHERE l.scene_set_id IN (:ids) AND l.deleted_at IS NULL
      ORDER BY l.updated_at DESC`,
    { replacements: { ids } });
  for (const r of rows) {
    if (!bySet.has(r.scene_set_id)) bySet.set(r.scene_set_id, []);
    bySet.get(r.scene_set_id).push(r);
  }
  return bySet;
}

module.exports = {
  STEPS,
  VenueLookImageError,
  resolveLookSet,
  planLook,
  lookBrief,
  startLook,
  eventLook,
  looksForSets,
};

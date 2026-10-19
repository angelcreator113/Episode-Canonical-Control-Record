/**
 * Dressed angles: an episode's angles at its event's venue, made from the
 * event's dressed look (Evoni's ruling L10 and her answers, 2026-10-02;
 * docs/EVENT_EPISODE_FLOW.md §8(hh)).
 *
 *   L10. "When an event has a dressed look, its episode's angles at that
 *   venue are made from the dressed look instead of the plain approved
 *   base (the look is the episode's room); without a look, the approved
 *   base is used as today."
 *
 * Her answers (accepting the four recommendations):
 *   1. Dressed angles are stored per look (scene_set_look_angles), so the
 *      set's angles stay plain.
 *   2. Only episode-made angles are dressed (the Beat Plan's Generate angle
 *      and Upload image), when the event has a complete look. Scene Sets'
 *      own generation stays plain.
 *   3. Beats at the look's set show and count the dressed angle when there
 *      is one, else the plain angle; with no look, everything is as today.
 *   4. Each dressed angle is a new image call, its cost shown first (S2).
 *
 * The episode's event is the live event whose used_in_episode_id is the
 * episode; its look on a set is that set's complete scene_set_looks row.
 * A dressed angle is one Flux Kontext edit of the look image: the angle's
 * brief (place, event, shot and the continuity line) moves the camera in
 * the dressed room.
 */

const { buildSceneBrief, briefToPrompt, loadBriefLocation, loadBriefEvent, readBriefOverrides } = require('./sceneBriefService');

class DressedAngleError extends Error {
  constructor(message, status = 400, code = 'DRESSED_ANGLE_INVALID') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** The episode's live event: { id, show_id, name } or null. */
async function episodeEvent(sequelize, episodeId) {
  if (!episodeId) return null;
  const [[event]] = await sequelize.query(
    `SELECT id, show_id, name, scene_set_id, venue_location_id, canon_consequences FROM world_events
      WHERE id = ${require('../utils/episodeEventSql').EPISODE_EVENT_ID_SQL}`,
    { replacements: { episodeId } });
  return event || null;
}

/** The episode's complete looks, by set id: Map<setId, { id, image_url, event_id }>. */
async function episodeLooks(sequelize, episodeId) {
  const event = await episodeEvent(sequelize, episodeId);
  const out = new Map();
  if (!event) return out;
  // A generated look is an edit of the venue's approved base: one made from
  // a base that is no longer approved shows the old room, so it is not used
  // (audit, 2026-10-15). An uploaded look is her own picture and stays.
  const [rows] = await sequelize.query(
    `SELECT sl.id, sl.scene_set_id, sl.image_url, sl.event_id FROM scene_set_looks sl
       JOIN scene_sets s ON s.id = sl.scene_set_id
       -- The venue the look was made at: the brief's (a look on a set with
       -- no location of its own is made at the event's venue), else the set's.
       LEFT JOIN world_locations l
         ON l.id = COALESCE(NULLIF(sl.brief->>'world_location_id', '')::uuid, s.world_location_id)
        AND l.deleted_at IS NULL
      -- A look being made again keeps its image in use until the new one is
      -- in: the episode lost its look for the whole run (fourth audit).
      WHERE sl.event_id = :eventId AND sl.status IN ('complete', 'generating') AND sl.image_url IS NOT NULL AND sl.deleted_at IS NULL
        -- Only the look on the set the event is held at now: a look left on
        -- the everyday set after the event moved to its own photos dressed
        -- that set's beats (eighth audit).
        AND (CAST(:eventSetId AS uuid) IS NULL OR sl.scene_set_id = CAST(:eventSetId AS uuid))
        AND (sl.source <> 'generated'
             OR sl.brief->'approved_base'->>'image_url' IS NULL
             OR sl.brief->'approved_base'->>'image_url' = l.approved_base_image_url
             -- An accepted episode keeps the look it was accepted with: its
             -- Place is locked, so the look could not be made again (fourth audit).
             OR EXISTS (SELECT 1 FROM episodes ep WHERE ep.id = :episodeId AND ep.deleted_at IS NULL AND ep.evaluation_status = 'accepted'))
        -- A look made at another venue than the event's is not the event's
        -- place any more: the event's venue changed (fourth audit).
        AND (CAST(:venueId AS uuid) IS NULL
             OR COALESCE(NULLIF(sl.brief->>'world_location_id', '')::uuid, s.world_location_id) IS NULL
             OR COALESCE(NULLIF(sl.brief->>'world_location_id', '')::uuid, s.world_location_id) = CAST(:venueId AS uuid))`,
    { replacements: { eventId: event.id, episodeId, eventSetId: event.scene_set_id || null, venueId: require('./venueGenerationService').venueLocationId(event) } });
  for (const r of rows) out.set(r.scene_set_id, { id: r.id, image_url: r.image_url, event_id: r.event_id });
  return out;
}

const STUCK_AFTER_MS = 10 * 60 * 1000;
const STUCK_REASON = 'The generation did not finish within 10 minutes. Try again.';
// A failed or stuck run on an angle that already had an image keeps that
// image in use, with the error beside it (audit, 2026-10-15).
const KEEP_PREVIOUS_IMAGE = `CASE WHEN image_url IS NOT NULL THEN 'complete' ELSE 'failed' END`;

/** The looks' dressed angles: Map<`${look_id}:${scene_angle_id}`, row>. */
async function lookAngles(sequelize, lookIds) {
  const ids = [...new Set((lookIds || []).filter(Boolean))];
  const out = new Map();
  if (!ids.length) return out;
  // A dressed angle generating for longer than STUCK_AFTER_MS (a restart, a
  // hung call) is marked failed, so the beat stops waiting on it (audit,
  // 2026-10-15: nothing ever released it).
  await sequelize.query(
    `UPDATE scene_set_look_angles SET status = ${KEEP_PREVIOUS_IMAGE}, error = :reason, updated_at = NOW()
      WHERE look_id IN (:ids) AND status = 'generating' AND deleted_at IS NULL
        AND updated_at < NOW() - make_interval(secs => :stuck)`,
    { replacements: { ids, reason: STUCK_REASON, stuck: STUCK_AFTER_MS / 1000 } });
  const [rows] = await sequelize.query(
    `SELECT id, look_id, scene_angle_id, status, image_url, source, error FROM scene_set_look_angles
      WHERE look_id IN (:ids) AND deleted_at IS NULL`,
    { replacements: { ids } });
  for (const r of rows) out.set(`${r.look_id}:${r.scene_angle_id}`, r);
  return out;
}

/** The angle, its set and the episode's look on that set; throws without a look. */
async function resolveTarget(sequelize, { episodeId, angleId }) {
  const [[angle]] = await sequelize.query(
    `SELECT a.id, a.scene_set_id, a.angle_label, a.angle_name, a.camera_direction, a.angle_kind,
            z.angle_kind AS zone_kind, z.angle_name AS zone_name
       FROM scene_angles a
       LEFT JOIN scene_angles z ON z.id = a.zone_angle_id AND z.scene_set_id = a.scene_set_id AND z.deleted_at IS NULL
      WHERE a.id = :angleId AND a.deleted_at IS NULL`,
    { replacements: { angleId } });
  if (!angle) throw new DressedAngleError('Angle not found', 404, 'ANGLE_NOT_FOUND');
  const [[set]] = await sequelize.query(
    `SELECT id, name, show_id, scene_type, world_location_id, base_still_url, canonical_description,
            visual_language, time_of_day, season, style_reference_url
       FROM scene_sets WHERE id = :id AND deleted_at IS NULL`,
    { replacements: { id: angle.scene_set_id } });
  if (!set) throw new DressedAngleError('Scene set not found', 404, 'SET_NOT_FOUND');
  const event = await episodeEvent(sequelize, episodeId);
  const look = (await episodeLooks(sequelize, episodeId)).get(set.id);
  if (!event || !look) {
    throw new DressedAngleError("This episode's event has no finished look on this set; the plain angle is used", 409, 'NO_LOOK');
  }
  return { angle, set, event, look };
}

/** The brief, prompt and estimate of a dressed angle (read only; S2's cost first). */
async function planDressedAngle(sequelize, { episodeId, angleId, overrides: rawOverrides }) {
  const overrides = readBriefOverrides(rawOverrides);
  if (overrides.error) throw new DressedAngleError(overrides.error);
  const { angle, set, event, look } = await resolveTarget(sequelize, { episodeId, angleId });
  const location = await loadBriefLocation(sequelize, set.world_location_id);
  const briefEvent = await loadBriefEvent(sequelize, event.id, null);
  // A zone is dressed as its own view of the place (L14 b), and a framing
  // on a Front or Back zone shows none of the described room, as when the
  // plain angle is made (audit, 2026-10-15).
  const sceneGen = require('./sceneGenerationService');
  const zone = sceneGen.zoneOf(angle);
  const partOf = !zone && angle.angle_kind === 'extra' && angle.zone_kind
    ? sceneGen.zoneOf({ angle_kind: angle.zone_kind, angle_name: angle.zone_name }) : null;
  const brief = {
    ...buildSceneBrief({
      sceneSet: set, location, event: briefEvent, angleLabel: angle.angle_label || 'WIDE',
      cameraDirection: angle.camera_direction || null, continuity: !zone, overrides: overrides.value || {},
      ...(zone ? { zone } : {}),
      ...(partOf ? { partOf } : {}),
    }),
    source: { kind: 'look', look_id: look.id, image_url: look.image_url },
  };
  return {
    angle, set, event, look, brief,
    prompt: briefToPrompt(brief),
    estimate: { ...sceneGen.estimateDressingCost(), base_model: sceneGen.SCENE_DRESSING_MODEL.key },
  };
}

/** The dressed-angle confirm's brief: { target, brief, prompt, estimate }. */
async function dressedAngleBrief(sequelize, args) {
  const plan = await planDressedAngle(sequelize, args);
  return {
    target: { kind: 'dressed_angle', angle_id: plan.angle.id, angle_label: plan.angle.angle_label, angle_name: plan.angle.angle_name, look_id: plan.look.id },
    brief: plan.brief,
    prompt: plan.prompt,
    estimate: plan.estimate,
  };
}

async function upsertRow(sequelize, { lookId, angleId, status, imageUrl = null, source, brief = null, estimate = null }) {
  const generating = status === 'generating';
  // A run claims the row: it does not replace a run still going (a double
  // click paid twice), and the row keeps its current image, source, brief
  // and cost until the run has its own image; a failed run that kept the
  // old image had already named it generated from the new look (audit,
  // 2026-10-15). An upload always wins and replaces all of it.
  const onConflict = generating
    ? `DO UPDATE SET status = 'generating', estimate_usd = EXCLUDED.estimate_usd, error = NULL, updated_at = NOW()
       WHERE scene_set_look_angles.status <> 'generating' OR scene_set_look_angles.updated_at < NOW() - make_interval(secs => ${STUCK_AFTER_MS / 1000})`
    : `DO UPDATE SET status = EXCLUDED.status, image_url = EXCLUDED.image_url, source = EXCLUDED.source, brief = EXCLUDED.brief,
                     estimate_usd = EXCLUDED.estimate_usd, cost_usd = NULL, error = NULL,
                     generated_at = EXCLUDED.generated_at, updated_at = NOW()`;
  const [[row]] = await sequelize.query(
    `INSERT INTO scene_set_look_angles (id, look_id, scene_angle_id, status, image_url, source, brief, estimate_usd, error, generated_at, created_at, updated_at)
     VALUES (gen_random_uuid(), :lookId, :angleId, :status, :imageUrl, :source, CAST(:brief AS jsonb), :estimate, NULL,
             CASE WHEN :status = 'complete' THEN NOW() ELSE NULL END, NOW(), NOW())
     ON CONFLICT (look_id, scene_angle_id) WHERE deleted_at IS NULL
     ${onConflict}
     RETURNING id, updated_at::text AS claimed_at`,
    { replacements: { lookId, angleId, status, imageUrl, source, brief: brief ? JSON.stringify(brief) : null, estimate } });
  if (!row) throw new DressedAngleError('This dressed angle is already being generated. Wait for it to finish.', 409, 'ANGLE_GENERATING');
  return row;
}

// This run's row: still generating since this run claimed it (the claim's
// own updated_at, exact as text). An upload, a sweep or a newer run
// changes it, and the late result is not kept.
const OWN_ANGLE_RUN = `id = :id AND status = 'generating' AND updated_at = CAST(:claimedAt AS timestamptz) AND deleted_at IS NULL`;

/**
 * "Generate angle" on a beat at the look's set, after the cost was
 * confirmed. Returns { result, run }: result is what the route answers
 * now; run() makes the image after it.
 */
async function startDressedAngle(sequelize, args) {
  if (!process.env.FAL_KEY) throw new DressedAngleError('A dressed angle uses Flux Kontext, which needs FAL_KEY, which is not configured.', 503, 'PROVIDER_NOT_CONFIGURED');
  const plan = await planDressedAngle(sequelize, args);
  const claim = await upsertRow(sequelize, {
    lookId: plan.look.id, angleId: plan.angle.id, status: 'generating', source: 'generated',
    brief: plan.brief, estimate: plan.estimate?.usd ?? null,
  });
  const rowId = claim.id;
  const run = async () => {
    const sceneGen = require('./sceneGenerationService');
    try {
      const out = await sceneGen.generateDressedStill(plan.set, plan.prompt, plan.look.image_url, { suffix: `look-angle-${rowId}` });
      // Only this run's row: an upload since is kept (audit, 2026-10-15).
      await sequelize.query(
        `UPDATE scene_set_look_angles SET status = 'complete', image_url = :url, source = 'generated', brief = CAST(:brief AS jsonb),
                cost_usd = :cost, generated_at = NOW(), updated_at = NOW()
          WHERE ${OWN_ANGLE_RUN}`,
        { replacements: { id: rowId, claimedAt: claim.claimed_at, url: out.stillUrl, cost: out.cost, brief: JSON.stringify(plan.brief) } });
    } catch (err) {
      console.error(`[DressedAngle] ${plan.angle.angle_name || plan.angle.angle_label} on "${plan.set.name}" failed:`, err.message);
      await sequelize.query(
        `UPDATE scene_set_look_angles SET status = ${KEEP_PREVIOUS_IMAGE}, error = :error, updated_at = NOW() WHERE ${OWN_ANGLE_RUN}`,
        { replacements: { id: rowId, claimedAt: claim.claimed_at, error: String(err.message || err).slice(0, 500) } });
    }
  };
  return { result: { id: rowId, status: 'generating', look_id: plan.look.id, angle_id: plan.angle.id }, run };
}

/** "Upload image" on a beat at the look's set: the image is the dressed angle. */
async function saveUploadedDressedAngle(sequelize, { episodeId, angleId, imageUrl }) {
  const { angle, look } = await resolveTarget(sequelize, { episodeId, angleId });
  const { id } = await upsertRow(sequelize, { lookId: look.id, angleId: angle.id, status: 'complete', imageUrl, source: 'uploaded' });
  return { id, status: 'complete', image_url: imageUrl, look_id: look.id, angle_id: angle.id };
}

module.exports = {
  DressedAngleError,
  episodeEvent,
  episodeLooks,
  lookAngles,
  dressedAngleBrief,
  startDressedAngle,
  saveUploadedDressedAngle,
};

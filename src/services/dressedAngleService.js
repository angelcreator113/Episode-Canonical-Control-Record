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
    `SELECT id, show_id, name FROM world_events
      WHERE used_in_episode_id = :episodeId AND deleted_at IS NULL
      ORDER BY updated_at DESC LIMIT 1`,
    { replacements: { episodeId } });
  return event || null;
}

/** The episode's complete looks, by set id: Map<setId, { id, image_url, event_id }>. */
async function episodeLooks(sequelize, episodeId) {
  const event = await episodeEvent(sequelize, episodeId);
  const out = new Map();
  if (!event) return out;
  const [rows] = await sequelize.query(
    `SELECT id, scene_set_id, image_url, event_id FROM scene_set_looks
      WHERE event_id = :eventId AND status = 'complete' AND image_url IS NOT NULL AND deleted_at IS NULL`,
    { replacements: { eventId: event.id } });
  for (const r of rows) out.set(r.scene_set_id, { id: r.id, image_url: r.image_url, event_id: r.event_id });
  return out;
}

/** The looks' dressed angles: Map<`${look_id}:${scene_angle_id}`, row>. */
async function lookAngles(sequelize, lookIds) {
  const ids = [...new Set((lookIds || []).filter(Boolean))];
  const out = new Map();
  if (!ids.length) return out;
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
    `SELECT id, scene_set_id, angle_label, angle_name, camera_direction FROM scene_angles
      WHERE id = :angleId AND deleted_at IS NULL`,
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
  const brief = {
    ...buildSceneBrief({
      sceneSet: set, location, event: briefEvent, angleLabel: angle.angle_label || 'WIDE',
      cameraDirection: angle.camera_direction || null, continuity: true, overrides: overrides.value || {},
    }),
    source: { kind: 'look', look_id: look.id, image_url: look.image_url },
  };
  const sceneGen = require('./sceneGenerationService');
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
  const [[row]] = await sequelize.query(
    `INSERT INTO scene_set_look_angles (id, look_id, scene_angle_id, status, image_url, source, brief, estimate_usd, error, generated_at, created_at, updated_at)
     VALUES (gen_random_uuid(), :lookId, :angleId, :status, :imageUrl, :source, CAST(:brief AS jsonb), :estimate, NULL,
             CASE WHEN :status = 'complete' THEN NOW() ELSE NULL END, NOW(), NOW())
     ON CONFLICT (look_id, scene_angle_id) WHERE deleted_at IS NULL
     DO UPDATE SET status = EXCLUDED.status, image_url = EXCLUDED.image_url, source = EXCLUDED.source, brief = EXCLUDED.brief,
                   estimate_usd = EXCLUDED.estimate_usd, cost_usd = NULL, error = NULL,
                   generated_at = EXCLUDED.generated_at, updated_at = NOW()
     RETURNING id`,
    { replacements: { lookId, angleId, status, imageUrl, source, brief: brief ? JSON.stringify(brief) : null, estimate } });
  return row.id;
}

/**
 * "Generate angle" on a beat at the look's set, after the cost was
 * confirmed. Returns { result, run }: result is what the route answers
 * now; run() makes the image after it.
 */
async function startDressedAngle(sequelize, args) {
  if (!process.env.FAL_KEY) throw new DressedAngleError('A dressed angle uses Flux Kontext, which needs FAL_KEY, which is not configured.', 503, 'PROVIDER_NOT_CONFIGURED');
  const plan = await planDressedAngle(sequelize, args);
  const rowId = await upsertRow(sequelize, {
    lookId: plan.look.id, angleId: plan.angle.id, status: 'generating', source: 'generated',
    brief: plan.brief, estimate: plan.estimate?.usd ?? null,
  });
  const run = async () => {
    const sceneGen = require('./sceneGenerationService');
    try {
      const out = await sceneGen.generateDressedStill(plan.set, plan.prompt, plan.look.image_url, { suffix: `look-angle-${rowId}` });
      await sequelize.query(
        `UPDATE scene_set_look_angles SET status = 'complete', image_url = :url, cost_usd = :cost, generated_at = NOW(), updated_at = NOW()
          WHERE id = :id`,
        { replacements: { id: rowId, url: out.stillUrl, cost: out.cost } });
    } catch (err) {
      console.error(`[DressedAngle] ${plan.angle.angle_name || plan.angle.angle_label} on "${plan.set.name}" failed:`, err.message);
      await sequelize.query(
        `UPDATE scene_set_look_angles SET status = 'failed', error = :error, updated_at = NOW() WHERE id = :id`,
        { replacements: { id: rowId, error: String(err.message || err).slice(0, 500) } });
    }
  };
  return { result: { id: rowId, status: 'generating', look_id: plan.look.id, angle_id: plan.angle.id }, run };
}

/** "Upload image" on a beat at the look's set: the image is the dressed angle. */
async function saveUploadedDressedAngle(sequelize, { episodeId, angleId, imageUrl }) {
  const { angle, look } = await resolveTarget(sequelize, { episodeId, angleId });
  const id = await upsertRow(sequelize, { lookId: look.id, angleId: angle.id, status: 'complete', imageUrl, source: 'uploaded' });
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

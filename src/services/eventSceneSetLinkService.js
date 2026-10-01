/**
 * Linking an attached event's scene set to its episode (F2, Evoni,
 * 2026-10-01): "the required links commit together or not at all; if the
 * scene-set link can't be made, the UI shows "Event attached · Scene set
 * needs reconnecting" with a Retry."
 *
 * The scene-set link runs inside the attach's transaction, in a savepoint:
 * if it fails, only it is rolled back, and the attach commits with the
 * status saying so. The statuses:
 *   linked              the episode is linked to the event's scene set
 *   choose              no set was chosen and its venue has several:
 *                       Evoni chooses one (options)
 *   needs_reconnecting  the link could not be made, or its venue has no set;
 *                       reason says why
 *
 * F3 (Evoni, 2026-10-01): with no scene set chosen, "use the venue's World
 * Location to list its sets; one is used only when it's the only one,
 * otherwise Evoni chooses; none means no link plus the reconnect prompt."
 * Never a first match (S3, S7). A set is at the venue when it is at the
 * venue's World Location, whatever its show (as S7's picker lists them).
 */

const { venueLocationId } = require('./venueGenerationService');

const STATUS = Object.freeze({
  LINKED: 'linked',
  CHOOSE: 'choose',
  NEEDS_RECONNECTING: 'needs_reconnecting',
});

async function insertEpisodeLink(sequelize, { sceneSetId, episodeId, transaction }) {
  await sequelize.query(
    `INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, created_at, updated_at)
     VALUES (gen_random_uuid(), :sceneSetId, :episodeId, NOW(), NOW())
     ON CONFLICT (scene_set_id, episode_id) WHERE deleted_at IS NULL DO NOTHING`,
    { replacements: { sceneSetId, episodeId }, transaction });
}

async function liveSceneSet(sequelize, sceneSetId, transaction) {
  const [[set]] = await sequelize.query(
    'SELECT id, name FROM scene_sets WHERE id = :sceneSetId AND deleted_at IS NULL',
    { replacements: { sceneSetId }, transaction });
  return set || null;
}

/** The live scene sets at the event's venue World Location, by name. */
async function venueSceneSets(sequelize, locationId, transaction) {
  if (!locationId) return [];
  const [rows] = await sequelize.query(
    `SELECT id, name, base_still_url FROM scene_sets
      WHERE world_location_id = :locationId AND deleted_at IS NULL
      ORDER BY name ASC, created_at ASC`,
    { replacements: { locationId }, transaction });
  return rows;
}

/**
 * Link the event's scene set to the episode inside `transaction`, in a
 * savepoint. Never throws for a link that cannot be made: the result says so.
 */
async function linkEventSceneSet(sequelize, { event, episodeId, transaction, chosenSceneSetId = null }) {
  const wanted = chosenSceneSetId || event.scene_set_id || null;
  try {
    return await sequelize.transaction({ transaction }, async (sp) => {
      let sceneSetId = wanted;
      if (!sceneSetId) {
        const locationId = venueLocationId(event);
        const options = await venueSceneSets(sequelize, locationId, sp);
        if (options.length > 1) {
          return { status: STATUS.CHOOSE, scene_set_id: null, options, reason: 'The venue has several scene sets: choose one.' };
        }
        if (options.length === 0) {
          return {
            status: STATUS.NEEDS_RECONNECTING, scene_set_id: null, options: [],
            reason: locationId
              ? 'The venue has no scene set yet: create one for it, then retry.'
              : 'The event has no venue World Location, so no scene set was linked.',
          };
        }
        sceneSetId = options[0].id;
      }
      const set = await liveSceneSet(sequelize, sceneSetId, sp);
      if (!set) {
        return { status: STATUS.NEEDS_RECONNECTING, scene_set_id: sceneSetId, reason: 'The event\'s scene set no longer exists.' };
      }
      if (sceneSetId !== event.scene_set_id) {
        await sequelize.query(
          'UPDATE world_events SET scene_set_id = :sceneSetId, updated_at = NOW() WHERE id = :eventId',
          { replacements: { sceneSetId, eventId: event.id }, transaction: sp });
      }
      await insertEpisodeLink(sequelize, { sceneSetId, episodeId, transaction: sp });
      return { status: STATUS.LINKED, scene_set_id: sceneSetId, scene_set_name: set.name };
    });
  } catch (err) {
    console.error('[eventSceneSetLink] scene set link failed:', err.message);
    return { status: STATUS.NEEDS_RECONNECTING, scene_set_id: wanted, reason: `The scene set could not be linked: ${err.message}` };
  }
}

module.exports = { STATUS, linkEventSceneSet };

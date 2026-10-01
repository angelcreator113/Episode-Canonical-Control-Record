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
 *   needs_reconnecting  the link could not be made; reason says why
 *   none                the event has no scene set and none was matched
 */

const STATUS = Object.freeze({
  LINKED: 'linked',
  NEEDS_RECONNECTING: 'needs_reconnecting',
  NONE: 'none',
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

/**
 * Before F3: with no scene set on the event, a set is matched from its
 * location hint (kept as it was; F3 replaces it).
 */
async function matchFromLocationHint(sequelize, event, transaction) {
  if (!event.location_hint) return null;
  const [rows] = await sequelize.query(
    `SELECT ss.id FROM scene_sets ss
     JOIN world_locations wl ON wl.id = ss.world_location_id
     WHERE wl.name ILIKE :hint AND wl.deleted_at IS NULL AND ss.deleted_at IS NULL
     LIMIT 1`,
    { replacements: { hint: `%${event.location_hint.split(',')[0].trim()}%` }, transaction });
  return rows[0]?.id || null;
}

/**
 * Link the event's scene set to the episode inside `transaction`, in a
 * savepoint. Never throws for a link that cannot be made: the result says so.
 */
async function linkEventSceneSet(sequelize, { event, episodeId, transaction }) {
  const wanted = event.scene_set_id || null;
  try {
    return await sequelize.transaction({ transaction }, async (sp) => {
      let sceneSetId = wanted;
      if (!sceneSetId) {
        sceneSetId = await matchFromLocationHint(sequelize, event, sp);
        if (!sceneSetId) return { status: STATUS.NONE, scene_set_id: null };
        await sequelize.query(
          'UPDATE world_events SET scene_set_id = :sceneSetId, updated_at = NOW() WHERE id = :eventId',
          { replacements: { sceneSetId, eventId: event.id }, transaction: sp });
      }
      const set = await liveSceneSet(sequelize, sceneSetId, sp);
      if (!set) {
        return { status: STATUS.NEEDS_RECONNECTING, scene_set_id: sceneSetId, reason: 'The event\'s scene set no longer exists.' };
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

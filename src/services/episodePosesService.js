'use strict';

/**
 * Character poses (episode_character_poses): photos of Lala and JustAWoman
 * for one episode, uploaded on the episode's Files tab and labelled Front,
 * Back, Side or Glamour (Evoni, 2026-10-20). Raw SQL, like episode_raw_clips.
 * Reads and writes only this table, and reads episodes to check the episode
 * exists.
 *
 * A pose holds several photos; one per (episode, character, pose) is the
 * default (a partial unique index keeps it to one). The first photo of a
 * pose becomes its default; starring another moves it.
 *
 * The image work (colour, upscale, background removal, edges, S3) is in
 * episodePoseMedia.js.
 */

const CHARACTERS = Object.freeze(['lala', 'justawoman']);
// Characters whose photos keep their background (Evoni, 2026-10-21):
// JustAWoman's are colour-fixed and upscaled, never cut out.
const KEEP_BACKGROUND = Object.freeze(['justawoman']);
const keepsBackground = (characterKey) => KEEP_BACKGROUND.includes(characterKey);
const POSES = Object.freeze(['front', 'back', 'side', 'glamour']);
const STATUSES = Object.freeze(['queued', 'processing', 'ready', 'failed']);

const COLUMNS = `id, episode_id, show_id, character_key, pose, is_default, original_filename, content_type,
  file_size_bytes, width, height, original_url, enhanced_url, final_url, final_width, final_height,
  status, error, steps, started_at, finished_at, created_at, updated_at`;

// A job still queued or processing this long after its last update was cut
// off (the server restarted mid-job); list marks it failed so Retry shows.
const STALE_MINUTES = 30;
const STALE_MESSAGE = 'Stopped before it finished (the server restarted). Press Retry.';

class PoseError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Validates character_key, pose and is_default (only the keys given). */
function readFields(body = {}, { requireAll = false } = {}) {
  const out = {};
  if (body.character_key !== undefined || requireAll) {
    if (!CHARACTERS.includes(body.character_key)) throw new PoseError(400, `character_key must be one of ${CHARACTERS.join(', ')}`);
    out.character_key = body.character_key;
  }
  if (body.pose !== undefined || requireAll) {
    if (!POSES.includes(body.pose)) throw new PoseError(400, `pose must be one of ${POSES.join(', ')}`);
    out.pose = body.pose;
  }
  if (body.is_default !== undefined) {
    const v = body.is_default;
    if (v === true || v === 'true') out.is_default = true;
    else if (v === false || v === 'false') out.is_default = false;
    else throw new PoseError(400, 'is_default must be true or false');
  }
  return out;
}

// Postgres 23505: unique_violation (the one-default index).
const isUniqueViolation = (err) => (err?.original?.code || err?.parent?.code || err?.code) === '23505';

async function findEpisode(sequelize, episodeId) {
  const [[episode]] = await sequelize.query(
    'SELECT id, show_id FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1',
    { replacements: { episodeId } });
  if (!episode) throw new PoseError(404, 'Episode not found');
  return episode;
}

/**
 * The episode's live poses: by character, then pose, the default first,
 * then newest first. Jobs left queued or processing past STALE_MINUTES (and
 * not running now: activeIds) are marked failed first.
 */
async function listPoses(sequelize, episodeId, { activeIds = [] } = {}) {
  await sequelize.query(
    `UPDATE episode_character_poses
        SET status = 'failed', error = :message, finished_at = NOW(), updated_at = NOW()
      WHERE episode_id = :episodeId AND deleted_at IS NULL
        AND status IN ('queued', 'processing')
        AND updated_at < NOW() - INTERVAL '${STALE_MINUTES} minutes'
        ${activeIds.length ? 'AND id NOT IN (:activeIds)' : ''}`,
    { replacements: { episodeId, message: STALE_MESSAGE, activeIds } });
  const [rows] = await sequelize.query(
    `SELECT ${COLUMNS} FROM episode_character_poses
      WHERE episode_id = :episodeId AND deleted_at IS NULL
      ORDER BY character_key, array_position(ARRAY['front', 'back', 'side', 'glamour']::varchar[], pose::varchar),
               is_default DESC, created_at DESC`,
    { replacements: { episodeId } });
  return rows || [];
}

/** One live pose of the episode, with its S3 keys (for the image work), or null. */
async function getPose(sequelize, episodeId, poseId) {
  const [[row]] = await sequelize.query(
    `SELECT ${COLUMNS}, original_key, enhanced_key, final_key FROM episode_character_poses
      WHERE id = :poseId AND episode_id = :episodeId AND deleted_at IS NULL LIMIT 1`,
    { replacements: { episodeId, poseId } });
  return row || null;
}

/**
 * Inserts a pose row (status queued). The first photo of its pose becomes
 * the default; when two arrive at once and the second loses the race for
 * the default, it is saved as not the default.
 */
async function createPose(sequelize, pose) {
  const replacements = {
    id: pose.id, episodeId: pose.episode_id, showId: pose.show_id || null,
    character: pose.character_key, pose: pose.pose,
    originalFilename: pose.original_filename || null, contentType: pose.content_type || null,
    size: pose.file_size_bytes ?? null, width: pose.width ?? null, height: pose.height ?? null,
    originalKey: pose.original_key, originalUrl: pose.original_url || null, createdBy: pose.created_by || null,
  };
  const insert = (defaultSql) => sequelize.query(
    `INSERT INTO episode_character_poses
       (id, episode_id, show_id, character_key, pose, is_default, original_filename, content_type,
        file_size_bytes, width, height, original_key, original_url, status, created_by, created_at, updated_at)
     VALUES (:id, :episodeId, :showId, :character, :pose, ${defaultSql}, :originalFilename, :contentType,
        :size, :width, :height, :originalKey, :originalUrl, 'queued', :createdBy, NOW(), NOW())
     RETURNING ${COLUMNS}`,
    { replacements });
  const firstOfPose = `NOT EXISTS (SELECT 1 FROM episode_character_poses
      WHERE episode_id = :episodeId AND character_key = :character AND pose = :pose
        AND is_default AND deleted_at IS NULL)`;
  try {
    const [[row]] = await insert(firstOfPose);
    return row;
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    console.error('[poses] another photo became the default first; saving this one without it:', err.message);
    const [[row]] = await insert('false');
    return row;
  }
}

/**
 * Updates character_key, pose and is_default. Returns the row, or null when
 * there is no such pose. Starring one un-stars the others of the same
 * character and pose, in one transaction. Moving a default to another pose
 * or character drops its star (that pose may have its own default).
 */
async function updatePose(sequelize, episodeId, poseId, body = {}) {
  const fields = readFields(body);
  if (!Object.keys(fields).length) throw new PoseError(400, 'Nothing to change: send character_key, pose or is_default');
  return sequelize.transaction(async (transaction) => {
    const [[current]] = await sequelize.query(
      `SELECT id, character_key, pose, is_default FROM episode_character_poses
        WHERE id = :poseId AND episode_id = :episodeId AND deleted_at IS NULL LIMIT 1 FOR UPDATE`,
      { replacements: { episodeId, poseId }, transaction });
    if (!current) return null;
    const next = {
      character_key: fields.character_key ?? current.character_key,
      pose: fields.pose ?? current.pose,
      is_default: fields.is_default ?? current.is_default,
    };
    const moved = next.character_key !== current.character_key || next.pose !== current.pose;
    if (moved && fields.is_default === undefined) next.is_default = false;
    if (next.is_default) {
      await sequelize.query(
        `UPDATE episode_character_poses SET is_default = false, updated_at = NOW()
          WHERE episode_id = :episodeId AND character_key = :character AND pose = :pose
            AND id <> :poseId AND is_default AND deleted_at IS NULL`,
        { replacements: { episodeId, poseId, character: next.character_key, pose: next.pose }, transaction });
    }
    const [[row]] = await sequelize.query(
      `UPDATE episode_character_poses
          SET character_key = :character, pose = :pose, is_default = :isDefault, updated_at = NOW()
        WHERE id = :poseId AND episode_id = :episodeId AND deleted_at IS NULL
        RETURNING ${COLUMNS}`,
      { replacements: { episodeId, poseId, character: next.character_key, pose: next.pose, isDefault: next.is_default }, transaction });
    return row || null;
  });
}

/**
 * Sets the processing state. extra: { error, steps, enhancedKey,
 * enhancedUrl, finalKey, finalUrl, finalWidth, finalHeight }.
 * queued clears the last run's error and files; failed keeps the files that
 * were made before the failure.
 */
async function setState(sequelize, poseId, status, extra = {}) {
  if (!STATUSES.includes(status)) throw new PoseError(400, `status must be one of ${STATUSES.join(', ')}`);
  const sets = ['status = :status', 'updated_at = NOW()'];
  const replacements = { poseId, status };
  const put = (column, name, value) => {
    if (value === undefined) return;
    sets.push(`${column} = :${name}`);
    replacements[name] = value;
  };
  if (status === 'queued') sets.push('error = NULL', 'started_at = NULL', 'finished_at = NULL');
  if (status === 'processing') sets.push('started_at = COALESCE(started_at, NOW())', 'error = NULL');
  if (status === 'ready' || status === 'failed') sets.push('finished_at = NOW()');
  if (status === 'ready') sets.push('error = NULL');
  if (status === 'failed') put('error', 'error', String(extra.error || 'Processing failed').slice(0, 1000));
  if (extra.steps !== undefined) put('steps', 'steps', JSON.stringify(extra.steps || {}));
  put('enhanced_key', 'enhancedKey', extra.enhancedKey);
  put('enhanced_url', 'enhancedUrl', extra.enhancedUrl);
  put('final_key', 'finalKey', extra.finalKey);
  put('final_url', 'finalUrl', extra.finalUrl);
  put('final_width', 'finalWidth', extra.finalWidth);
  put('final_height', 'finalHeight', extra.finalHeight);
  const [rows] = await sequelize.query(
    `UPDATE episode_character_poses SET ${sets.join(', ')} WHERE id = :poseId AND deleted_at IS NULL RETURNING ${COLUMNS}`,
    { replacements });
  return (rows || [])[0] || null;
}

/** Soft-deletes one of the episode's poses (its files stay in S3). True when one was removed. */
async function removePose(sequelize, episodeId, poseId) {
  const [rows] = await sequelize.query(
    `UPDATE episode_character_poses SET deleted_at = NOW(), is_default = false, updated_at = NOW()
      WHERE id = :poseId AND episode_id = :episodeId AND deleted_at IS NULL
      RETURNING id`,
    { replacements: { episodeId, poseId } });
  return (rows || []).length > 0;
}

module.exports = {
  CHARACTERS, KEEP_BACKGROUND, keepsBackground, POSES, STATUSES, STALE_MINUTES, STALE_MESSAGE, PoseError,
  readFields, findEpisode, listPoses, getPose, createPose, updatePose, setState, removePose,
};

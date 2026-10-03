'use strict';

/**
 * Performance clips (episode_performance_clips; the clip home agreed with
 * episode creation step 8, §8(o) item 2): an episode's JustAWoman and Lala
 * performance clips, one per canonical beat per performer. Raw SQL, like
 * the other tables of this kind (scene_set_looks). Reads and writes only
 * this table, and reads assets to check an attached asset exists.
 */

const PERFORMERS = Object.freeze(['justawoman', 'lala']);
const STATUSES = Object.freeze(['draft', 'approved']);
const COLUMNS = 'id, episode_id, canonical_beat_number, performer, asset_id, video_url, label, status, created_at, updated_at';

class ClipError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function listClips(sequelize, episodeId) {
  const [rows] = await sequelize.query(
    `SELECT ${COLUMNS} FROM episode_performance_clips
      WHERE episode_id = :episodeId AND deleted_at IS NULL
      ORDER BY canonical_beat_number ASC, performer ASC`,
    { replacements: { episodeId } });
  return rows || [];
}

/**
 * Attaches a clip to a beat for a performer; the live row for that beat and
 * performer is updated if there is one. body: { canonical_beat_number,
 * performer, asset_id?, video_url?, label?, status? }. Throws ClipError(400)
 * for bad input, (404) for an unknown episode or asset.
 */
async function attachClip(sequelize, episodeId, body = {}) {
  const beat = Number(body.canonical_beat_number);
  if (!Number.isInteger(beat) || beat < 1 || beat > 14) throw new ClipError(400, 'canonical_beat_number must be a whole number from 1 to 14');
  if (!PERFORMERS.includes(body.performer)) throw new ClipError(400, `performer must be one of ${PERFORMERS.join(', ')}`);
  const assetId = typeof body.asset_id === 'string' && body.asset_id.trim() ? body.asset_id.trim() : null;
  const videoUrl = typeof body.video_url === 'string' && body.video_url.trim() ? body.video_url.trim() : null;
  if (!assetId && !videoUrl) throw new ClipError(400, 'A clip needs an asset_id or a video_url');
  if (videoUrl && !/^https?:\/\//i.test(videoUrl)) throw new ClipError(400, 'video_url must start with http:// or https://');
  const status = body.status == null ? 'draft' : body.status;
  if (!STATUSES.includes(status)) throw new ClipError(400, `status must be one of ${STATUSES.join(', ')}`);
  const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim().slice(0, 200) : null;

  const [[episode]] = await sequelize.query(
    'SELECT id FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1',
    { replacements: { episodeId } });
  if (!episode) throw new ClipError(404, 'Episode not found');
  if (assetId) {
    const [[asset]] = await sequelize.query(
      'SELECT id FROM assets WHERE id = :assetId AND deleted_at IS NULL LIMIT 1',
      { replacements: { assetId } });
    if (!asset) throw new ClipError(404, 'Asset not found');
  }

  const replacements = { episodeId, beat, performer: body.performer, assetId, videoUrl, label, status };
  return sequelize.transaction(async (transaction) => {
    const [[existing]] = await sequelize.query(
      `SELECT id FROM episode_performance_clips
        WHERE episode_id = :episodeId AND canonical_beat_number = :beat AND performer = :performer AND deleted_at IS NULL
        LIMIT 1 FOR UPDATE`,
      { replacements, transaction });
    if (existing) {
      const [[row]] = await sequelize.query(
        `UPDATE episode_performance_clips
            SET asset_id = :assetId, video_url = :videoUrl, label = :label, status = :status, updated_at = NOW()
          WHERE id = :id
          RETURNING ${COLUMNS}`,
        { replacements: { ...replacements, id: existing.id }, transaction });
      return { clip: row, replaced: true };
    }
    const [[row]] = await sequelize.query(
      `INSERT INTO episode_performance_clips
         (episode_id, canonical_beat_number, performer, asset_id, video_url, label, status, created_at, updated_at)
       VALUES (:episodeId, :beat, :performer, :assetId, :videoUrl, :label, :status, NOW(), NOW())
       RETURNING ${COLUMNS}`,
      { replacements, transaction });
    return { clip: row, replaced: false };
  });
}

/** Soft-deletes one of the episode's clips. Returns true when one was removed. */
async function removeClip(sequelize, episodeId, clipId) {
  const [rows] = await sequelize.query(
    `UPDATE episode_performance_clips SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = :clipId AND episode_id = :episodeId AND deleted_at IS NULL
      RETURNING id`,
    { replacements: { episodeId, clipId } });
  return (rows || []).length > 0;
}

module.exports = { PERFORMERS, STATUSES, ClipError, listClips, attachClip, removeClip };

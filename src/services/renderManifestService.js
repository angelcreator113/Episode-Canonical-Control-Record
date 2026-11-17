'use strict';

/**
 * The render manifest of one saved edit version (Evoni, 2026-11-16; the first
 * step of the render): reads what utils/renderManifest needs and hands it
 * over. Reads only: SELECT statements, in one REPEATABLE READ transaction
 * that the database is told is READ ONLY. No storage call, no ffmpeg, no
 * job, no write of any kind.
 *
 * What it reads:
 * - The saved version (episodeEditService.versionRow, which checks its
 *   sha256 again) and, from its snapshot, the edit as the editor reads it
 *   (editFrom). The live edit is never read.
 * - The voice takes the snapshot's dialogue names, as they stand now
 *   (voiceTakesFor): an approval that is no longer current does not play and
 *   is a blocking finding; no other take stands in.
 * - The takes and scene angles the snapshot names, as they stand now: a take
 *   of this episode that is not removed, an angle that is not removed and
 *   whose set is linked to this episode. One that is gone is asset_missing
 *   in the manifest.
 * - The production coverage (productionCoverageService), outside the
 *   transaction (it takes none); a failed read is logged and leaves it null,
 *   which the manifest reports as not assessed.
 *
 * Findings: reviewReadiness reads the live edit only, so the snapshot's
 * findings are the pure ones (editTimeline.editFindings, inside
 * buildManifest). What reviewReadiness adds from other tables is not copied
 * here: a source that is gone shows as asset_missing; line_audio_unapproved
 * is not in a manifest yet.
 */

const edit = require('./episodeEditService');
const { buildManifest } = require('../utils/renderManifest');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SNAPSHOT_KEYS = ['beat_production', 'scene_clips', 'segments', 'pip', 'visibility', 'items', 'audio_items'];
const byId = (list) => Object.fromEntries(list.map((r) => [String(r.id), r]));
const uuids = (ids) => [...new Set(ids.filter((id) => UUID_RE.test(String(id || ''))).map(String))];

async function coverageOf(episodeId) {
  try {
    const models = require('../models');
    return await require('./productionCoverageService').loadCoverage(models, episodeId);
  } catch (err) {
    console.error('[RenderManifest] coverage read failed:', err.message);
    return null;
  }
}

async function manifestOf(sequelize, { episodeId, versionId, purpose, range }) {
  const { Transaction } = require('sequelize');
  const read = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ, readOnly: true }, async (t) => {
    await sequelize.query('SET TRANSACTION READ ONLY', { transaction: t });
    const rows = async (sql, replacements) => (await sequelize.query(sql, { replacements, transaction: t }))[0];
    const version = await edit.versionRow(sequelize, episodeId, versionId, t);
    const saved = version.snapshot && typeof version.snapshot === 'object' ? version.snapshot : {};
    const snapshot = Object.fromEntries(SNAPSHOT_KEYS.map((k) => [k, Array.isArray(saved[k]) ? saved[k] : []]));
    const takes = await edit.voiceTakesFor(sequelize, episodeId, snapshot, t);

    const clipIds = edit.snapshotRawClipIds(snapshot);
    const clips = clipIds.length ? await rows(`SELECT id, performer, s3_key_raw, url_raw, s3_key_cutout, url_cutout, key_status, content_type,
        file_size_bytes, duration_seconds::float8 AS duration_seconds, width, height
      FROM episode_raw_clips WHERE id IN (:clipIds) AND episode_id = :episodeId AND deleted_at IS NULL ORDER BY id`, { clipIds, episodeId }) : [];
    const angleIds = uuids(snapshot.scene_clips.filter((c) => c.source_kind !== 'raw_clip').map((c) => c.source_id));
    const angles = angleIds.length ? await rows(`SELECT a.id, a.scene_set_id, a.still_image_url, a.video_clip_url
      FROM scene_angles a
      WHERE a.id IN (:angleIds) AND a.deleted_at IS NULL
        AND EXISTS (SELECT 1 FROM scene_set_episodes l WHERE l.scene_set_id = a.scene_set_id AND l.episode_id = :episodeId AND l.deleted_at IS NULL)
      ORDER BY a.id`, { angleIds, episodeId }) : [];
    return { version, snapshot, takes, clips, angles };
  });

  const voiceSources = Object.fromEntries(Object.entries(read.takes).map(([approvalId, k]) => [approvalId, {
    source_asset_id: k.source_asset_id, s3_key: k.s3_key, sha256: k.sha256, source_kind: k.source_kind, content_type: k.content_type, duration_ms: k.source_duration_ms,
    lineage: k.source_raw_clip_id ? { raw_clip_id: k.source_raw_clip_id, source_in_ms: k.source_in_ms, source_out_ms: k.source_out_ms } : null,
  }]));
  const { version } = read;
  try {
    return buildManifest({
      purpose: purpose === 'final' ? 'final' : 'preview',
      episodeId,
      version: { id: version.id, snapshot_sha256: version.snapshot_sha256, edit_revision: version.edit_revision, script_revision: version.script_revision, script_seq: version.script_seq },
      edit: edit.editFrom(read.snapshot, read.takes),
      clips: byId(read.clips),
      angles: byId(read.angles),
      voiceSources,
      coverage: await coverageOf(episodeId),
      range,
    });
  } catch (err) {
    if (err.code === 'BAD_RANGE') throw new edit.EditError(400, 'BAD_RANGE', err.message);
    throw err;
  }
}

module.exports = { manifestOf };

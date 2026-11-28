'use strict';

/**
 * The still pictures an episode's edit may draw (Gate 2b; Evoni,
 * 2026-11-28), resolved in ONE place so the render manifest and the editor
 * never disagree about which picture an overlay item names.
 *
 * The rule was settled by PR 1 and is not restated here in a second form:
 * a picture is this episode's to draw when it is not removed, belongs to
 * this episode's show, and is either this episode's own or the show's to
 * reuse (`episode_id IS NULL`). A picture that fails any of those resolves
 * to nothing, and each caller reports that in its own words — the manifest
 * as its existing `asset_missing` blocking finding, the editor as a missing
 * graphic on the monitor.
 *
 * Reads only. The caller passes its own transaction, so the manifest keeps
 * reading everything in its one READ ONLY REPEATABLE READ unit.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The ids among `ids` that are UUIDs, each once, as strings. */
const uuids = (ids) => [...new Set((ids || []).filter((id) => UUID_RE.test(String(id || ''))).map(String))];

/** The asset ids the overlay items of `items` name. */
function overlayAssetIds(items) {
  return uuids((items || []).filter((i) => i && i.kind === 'overlay').map((i) => i.values && i.values.asset_id));
}

// Every column the manifest's assetBook reads, and the name it reads it
// under. The editor uses a subset; both get the same rows from the same
// rule, which is the point of this module.
const COLUMNS = `a.id, a.s3_key_raw AS storage_key, a.s3_url_processed AS url_processed,
        a.s3_url_raw AS url_raw, a.content_type, a.width, a.height, a.file_size_bytes AS size_bytes,
        a.file_hash AS sha256, a.metadata, a.name`;

/**
 * The rows for `ids` that this episode may draw, ordered by id.
 * @param {object} sequelize
 * @param {object} opts
 * @param {string} opts.episodeId
 * @param {string[]} opts.ids  asset ids; anything that is not a UUID is dropped
 * @param {object} [transaction]
 * @returns {Promise<object[]>}
 */
async function imageRowsFor(sequelize, { episodeId, ids }, transaction = undefined) {
  const imageIds = uuids(ids);
  if (!imageIds.length) return [];
  const [rows] = await sequelize.query(
    `SELECT ${COLUMNS}
      FROM assets a
      JOIN episodes e ON e.id = :episodeId
      WHERE a.id IN (:imageIds) AND a.deleted_at IS NULL
        AND a.show_id = e.show_id AND (a.episode_id IS NULL OR a.episode_id = :episodeId)
      ORDER BY a.id`,
    { replacements: { imageIds, episodeId }, transaction },
  );
  return rows || [];
}

/**
 * One row as the editor's preview needs it: what to draw and what to call
 * it, and nothing else. The URL is the processed one, else the raw one —
 * the same precedence the manifest's `assetBook.image` uses.
 */
const forPreview = (row) => ({
  id: String(row.id),
  url: row.url_processed || row.url_raw || null,
  width: row.width == null ? null : Number(row.width),
  height: row.height == null ? null : Number(row.height),
  name: row.name || null,
});

module.exports = { imageRowsFor, overlayAssetIds, forPreview, uuids };

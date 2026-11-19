'use strict';

/**
 * Document presentations are not attached like other assets.
 *
 * A document presentation (assets.asset_type DOCUMENT_PRESENTATION) is a
 * panel of an approved in-world document, drawn for video. It belongs to
 * its document's version and reaches an episode only through the
 * document's own pinning (Evoni, 2026-11-19). The generic operations that
 * store an asset on something else (an episode, a scene, a canvas, a layer,
 * a composition, a placement, a cue) refuse one, each with the same 409,
 * before they write anything.
 *
 * This is the one rule; every such operation calls it. It does not check
 * that an asset exists or whose it is: each operation keeps the checks it
 * already has.
 */

const DOCUMENT_PRESENTATION = 'DOCUMENT_PRESENTATION';
const REFUSAL_CODE = 'DOCUMENT_PRESENTATION_NOT_ATTACHABLE';
const REFUSAL_MESSAGE = 'A document presentation cannot be attached here. It belongs to its document and is not placed like other assets.';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for an asset row (model instance or plain row) that is a document presentation. */
function isDocumentPresentation(asset) {
  if (!asset) return false;
  const type = typeof asset.get === 'function' ? asset.get('asset_type') : asset.asset_type;
  return type === DOCUMENT_PRESENTATION;
}

/**
 * The asset ids among `values`: strings shaped like a UUID (space around
 * one is ignored, as some operations trim theirs), each once. Anything
 * else cannot name an asset.
 */
function assetIdsIn(values) {
  const list = Array.isArray(values) ? values : [values];
  return [...new Set(list.filter((v) => typeof v === 'string').map((v) => v.trim().toLowerCase()).filter((v) => UUID_RE.test(v)))];
}

/** Every UUID-shaped string anywhere inside a JSON value (an object of asset ids, lists of them). */
function assetIdsWithin(value, found = []) {
  if (typeof value === 'string') found.push(value);
  else if (Array.isArray(value)) value.forEach((v) => assetIdsWithin(v, found));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => assetIdsWithin(v, found));
  return assetIdsIn(found);
}

/**
 * True when any of `values` is the id of a document presentation. Reads
 * only; a soft-deleted one counts (it is one still). For an operation that
 * has no asset lookup of its own, or whose lookup comes after its first
 * write.
 */
async function anyDocumentPresentation(values, { sequelize = null, transaction = null } = {}) {
  const ids = assetIdsIn(values);
  if (!ids.length) return false;
  const db = sequelize || require('../models').sequelize;
  const [rows] = await db.query(
    'SELECT 1 FROM assets WHERE id IN (:ids) AND asset_type = :type LIMIT 1',
    { replacements: { ids, type: DOCUMENT_PRESENTATION }, ...(transaction ? { transaction } : {}) }
  );
  return rows.length > 0;
}

/** The one answer to an attempt to attach one. */
function refuseDocumentPresentation(res) {
  return res.status(409).json({ success: false, error: REFUSAL_MESSAGE, code: REFUSAL_CODE });
}

module.exports = {
  DOCUMENT_PRESENTATION,
  REFUSAL_CODE,
  REFUSAL_MESSAGE,
  isDocumentPresentation,
  assetIdsIn,
  assetIdsWithin,
  anyDocumentPresentation,
  refuseDocumentPresentation,
};

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

const HEX_32 = /^[0-9a-f]{32}$/;

/**
 * The one spelling of an asset id (lower case, 8-4-4-4-12), or null for a
 * value that cannot be one. PostgreSQL reads several spellings as the same
 * uuid: upper or lower case, with no hyphens, inside braces, hyphenated in
 * groups of four. Each has to be recognised here, or an id written another
 * way would pass the rule and still be stored as the asset it names. This
 * takes a little more than PostgreSQL does (hyphens anywhere, space around
 * it), which errs towards asking.
 */
function normalizeAssetId(value) {
  if (typeof value !== 'string') return null;
  let text = value.trim().toLowerCase();
  if (text.startsWith('{') && text.endsWith('}')) text = text.slice(1, -1);
  const hex = text.replace(/-/g, '');
  if (!HEX_32.test(hex)) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** True for an asset row (model instance or plain row) that is a document presentation. */
function isDocumentPresentation(asset) {
  if (!asset) return false;
  const type = typeof asset.get === 'function' ? asset.get('asset_type') : asset.asset_type;
  return type === DOCUMENT_PRESENTATION;
}

/**
 * The asset ids among `values`, each once, in the one spelling
 * (normalizeAssetId). Anything else cannot name an asset: the database
 * would not read it as a uuid either.
 */
function assetIdsIn(values) {
  const list = Array.isArray(values) ? values : [values];
  return [...new Set(list.map(normalizeAssetId).filter(Boolean))];
}

/** Every UUID-shaped string anywhere inside a JSON value (an object of asset ids, lists of them). */
function assetIdsWithin(value, found = []) {
  if (typeof value === 'string') found.push(value);
  else if (Array.isArray(value)) value.forEach((v) => assetIdsWithin(v, found));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => assetIdsWithin(v, found));
  return assetIdsIn(found);
}

/**
 * True when any of `values` is the id of a document presentation, however
 * the id is spelled. Reads only; a soft-deleted one counts (it is one
 * still). For an operation that has no asset lookup of its own, or whose
 * lookup comes after its first write. A read that fails throws: the caller
 * answers with its own error and attaches nothing, since "could not ask"
 * is not "may be attached".
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
  normalizeAssetId,
  assetIdsIn,
  assetIdsWithin,
  anyDocumentPresentation,
  refuseDocumentPresentation,
};

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
 *
 * It is also kept by its document (V2-2a, Evoni 2026-11-20): the generic
 * operations that edit, delete, relabel, approve, reject or process an
 * asset refuse one too (protectDocumentPresentations), no asset is made one
 * through them (refuseDocumentPresentationType), and the generic lists,
 * searches and pickers leave them out unless one is asked for by its type
 * (NOT_DOCUMENT_PRESENTATION_SQL, exceptDocumentPresentations).
 */

const DOCUMENT_PRESENTATION = 'DOCUMENT_PRESENTATION';
const REFUSAL_CODE = 'DOCUMENT_PRESENTATION_NOT_ATTACHABLE';
const REFUSAL_MESSAGE = 'A document presentation cannot be attached here. It belongs to its document and is not placed like other assets.';
const MANAGED_CODE = 'DOCUMENT_PRESENTATION_SYSTEM_MANAGED';
const MANAGED_MESSAGE = 'A document presentation is kept by its document. It cannot be changed, removed or made here.';
const CHECK_FAILED_MESSAGE = 'The asset could not be checked, so nothing was changed. Try again.';
/** For a query over the assets table (alias it yourself: `a.${…}` is not needed, asset_type is unambiguous there). */
const NOT_DOCUMENT_PRESENTATION_SQL = `asset_type IS DISTINCT FROM '${DOCUMENT_PRESENTATION}'`;

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

/** The one answer to an attempt to change, remove or make one through a generic operation. */
function refuseManagedDocumentPresentation(res) {
  return res.status(409).json({ success: false, error: MANAGED_MESSAGE, code: MANAGED_CODE });
}

/** True for the type's own name, however it is cased or padded. */
function isDocumentPresentationType(value) {
  return typeof value === 'string' && value.trim().toUpperCase() === DOCUMENT_PRESENTATION;
}

/**
 * Route middleware for an operation that edits, deletes, relabels,
 * approves, rejects or processes assets by id. `pick(req)` gives the id or
 * ids the request names. One document presentation among them refuses the
 * whole request, before the handler runs, so nothing is written. A check
 * that cannot be made refuses too (500): "could not ask" is not "may be
 * changed". Put it after the route's own authentication, which answers
 * first as it always did.
 */
function protectDocumentPresentations(pick) {
  return async function documentPresentationsAreManaged(req, res, next) {
    try {
      if (await anyDocumentPresentation(pick(req))) return refuseManagedDocumentPresentation(res);
    } catch (err) {
      console.error('[DocumentPresentation] the asset check failed (nothing was changed):', err.message);
      return res.status(500).json({ success: false, error: CHECK_FAILED_MESSAGE });
    }
    return next();
  };
}

/** Route middleware: no asset is given this type through a generic operation. `pick(req)` gives the type asked for. */
function refuseDocumentPresentationType(pick) {
  return function documentPresentationsAreNotMadeHere(req, res, next) {
    return isDocumentPresentationType(pick(req)) ? refuseManagedDocumentPresentation(res) : next();
  };
}

/** A Sequelize `where` with document presentations left out (asset_type is never null). */
function exceptDocumentPresentations(where = {}) {
  const { Op } = require('sequelize');
  return { ...where, [Op.and]: [...(where[Op.and] || []), { asset_type: { [Op.ne]: DOCUMENT_PRESENTATION } }] };
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
  MANAGED_CODE,
  MANAGED_MESSAGE,
  CHECK_FAILED_MESSAGE,
  NOT_DOCUMENT_PRESENTATION_SQL,
  refuseManagedDocumentPresentation,
  isDocumentPresentationType,
  protectDocumentPresentations,
  refuseDocumentPresentationType,
  exceptDocumentPresentations,
};

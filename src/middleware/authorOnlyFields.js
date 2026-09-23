'use strict';

/**
 * Author-only character fields — one place for who may see and write them.
 *
 * The four fields in RegistryCharacter.AUTHOR_ONLY_FIELDS (de_blind_spot,
 * de_blind_spot_evidence, de_blind_spot_crack_condition,
 * de_actual_narrative_gap) belong to the author, which is the Cognito admin
 * group (there is no 'author' group). Everyone else can neither read nor
 * write them.
 *
 *   canAccessAuthorFields(user)     — true for the admin group only
 *   stripAuthorOnlyFields(value)    — deep copy without the four fields
 *   hideAuthorOnlyFieldsFromNonAdmins — router-level middleware: strips the
 *       four fields from every res.json payload unless the caller is admin.
 *       req.user is read when the response is sent, so it works when mounted
 *       with router.use() ahead of per-route requireAuth.
 */

const { userInGroup } = require('./auth');
const { AUTHOR_ONLY_FIELDS } = require('../models/RegistryCharacter');

const AUTHOR_ONLY = new Set(AUTHOR_ONLY_FIELDS);

const canAccessAuthorFields = (user) => userInGroup(user, 'admin');

const stripAuthorOnlyFields = (value) => {
  if (Array.isArray(value)) return value.map(stripAuthorOnlyFields);
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  // Sequelize instances (and anything else JSON-serialisable via toJSON)
  if (typeof value.toJSON === 'function') return stripAuthorOnlyFields(value.toJSON());
  const out = {};
  for (const [key, v] of Object.entries(value)) {
    if (AUTHOR_ONLY.has(key)) continue;
    out[key] = stripAuthorOnlyFields(v);
  }
  return out;
};

const hideAuthorOnlyFieldsFromNonAdmins = (req, res, next) => {
  const originalJson = res.json;
  res.json = function (body) {
    const payload = canAccessAuthorFields(req.user) ? body : stripAuthorOnlyFields(body);
    return originalJson.call(this, payload);
  };
  next();
};

module.exports = {
  AUTHOR_ONLY_FIELDS,
  canAccessAuthorFields,
  stripAuthorOnlyFields,
  hideAuthorOnlyFieldsFromNonAdmins,
};

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// socialProfileHandle.js — the one handle-uniqueness check for social_profiles
// (Task #1886 semantics, shared by every create/rename path in Task #1893).
//
// A handle already held by a profile — live OR soft-deleted — is taken.
// Evoni's ruling (2026-09-25): a deleted creator can be restored, so a live and
// a deleted profile sharing a handle is the ambiguity being removed; to reuse a
// handle, restore or purge the holder first. Matching is case-insensitive and
// treats `@x` and `x` as the same handle.
//
// The column has no unique index (idx_social_profiles_handle is
// (handle, platform), non-unique), so this check is the only guard. There is a
// race window between the check and the insert; a unique index on
// lower(ltrim(handle, '@')) is its own follow-up.
//
// Used by:
//   src/routes/socialProfileRoutes.js      POST /generate, POST /autofill-draft,
//                                          PUT /:id, PATCH /:id (renames)
//   src/routes/socialProfileBulkRoutes.js  generateSingleProfile (bulk generate)
//   src/routes/characterGenerationRoutes.js POST /confirm-feed
//   src/services/feedScheduler.js          generateAndSaveProfile
//   src/services/feedAutoGeneration.js     autoCreateFeedProfile
// ─────────────────────────────────────────────────────────────────────────────

function normaliseHandle(handle) {
  // Same normalisation as the /generate create: add a leading @ when missing.
  const h = String(handle ?? '');
  return h.startsWith('@') ? h : `@${h}`;
}

// The comparison key: no leading @, lower-cased. Two handles with the same
// key are the same handle (used to de-duplicate within one bulk batch).
function handleKey(handle) {
  return normaliseHandle(handle).slice(1).toLowerCase();
}

function escapeLike(value) {
  // LIKE wildcards escaped — handles often contain underscores.
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// Returns the profile holding `handle` (case-insensitive, with or without the
// leading @, soft-deleted rows included), or null. `excludeId` leaves one
// profile out of the lookup — a rename passes the profile's own id, so saving
// the same handle, or changing only its case or its @, is not a collision.
async function findHandleHolder(db, handle, { excludeId } = {}) {
  const { Op } = require('sequelize');
  const withAt = normaliseHandle(handle);
  const forms = [withAt, withAt.slice(1)].filter(Boolean);
  const where = { [Op.or]: forms.map((f) => ({ handle: { [Op.iLike]: escapeLike(f) } })) };
  if (excludeId !== undefined && excludeId !== null) {
    where.id = { [Op.ne]: excludeId };
  }
  return db.SocialProfile.findOne({
    where,
    attributes: ['id', 'handle', 'deletedAt'],
    paranoid: false,
  });
}

function handleHolderIsDeleted(holder) {
  return !!(holder && (holder.deletedAt || holder.deleted_at));
}

function handleTakenMessage(handle, holder) {
  const h = normaliseHandle(handle);
  return handleHolderIsDeleted(holder)
    ? `${h} belongs to a deleted creator (id ${holder.id}) — restore or purge it to reuse the handle.`
    : `${h} is already taken by an existing creator (id ${holder.id}) — pick another handle.`;
}

// The 409 body every user-facing route returns for a taken handle (the
// POST /generate shape from Task #1886).
function handleTakenBody(handle, holder) {
  return {
    error: handleTakenMessage(handle, holder),
    handleTaken: true,
    handle: normaliseHandle(handle),
    holder: { id: holder.id, deleted: handleHolderIsDeleted(holder) },
  };
}

module.exports = {
  normaliseHandle,
  handleKey,
  escapeLike,
  findHandleHolder,
  handleHolderIsDeleted,
  handleTakenMessage,
  handleTakenBody,
};

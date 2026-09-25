'use strict';

/**
 * episodeWardrobeLinks — link a wardrobe item to an episode when the link
 * may have been removed before (Task #1924).
 *
 * EpisodeWardrobe is paranoid (Evoni's ruling (a), 2026-09-25): destroy()
 * sets deleted_at and the row stays. episode_wardrobe is unique on
 * (episode_id, wardrobe_id) — POST /wardrobe/select's
 * `ON CONFLICT (episode_id, wardrobe_id)` needs that constraint to exist —
 * so a plain create() of a pair whose earlier link was soft-deleted would
 * fail with a unique violation, and a paranoid findOrCreate() would not see
 * the deleted row and try that create. linkEpisodeWardrobe reads with
 * paranoid: false and restores the removed link instead.
 *
 * A restored link is a new link: it takes the values a create() would give
 * it (the model's approval default unless the caller sets one), not the
 * approval state the removed link had.
 */

const APPROVAL_RESET = Object.freeze({
  approval_status: 'pending',
  approved_by: null,
  approved_at: null,
  rejection_reason: null,
});

/**
 * @param {typeof import('sequelize').Model} EpisodeWardrobe
 * @param {{ episode_id: string, wardrobe_id: string }} pair
 * @param {object} [values] — the other columns a new link gets
 * @param {{ transaction?: object }} [options]
 * @returns {Promise<[object, 'created'|'restored'|false]>} the live link, and
 *   how it came to be: created, restored from a removed link, or already there (false)
 */
async function linkEpisodeWardrobe(EpisodeWardrobe, pair, values = {}, { transaction } = {}) {
  const where = { episode_id: pair.episode_id, wardrobe_id: pair.wardrobe_id };
  const existing = await EpisodeWardrobe.findOne({ where, paranoid: false, transaction });
  if (existing && !existing.deleted_at) return [existing, false];
  if (existing) {
    await existing.restore({ transaction });
    await existing.update({ ...APPROVAL_RESET, ...values }, { transaction });
    return [existing, 'restored'];
  }
  const created = await EpisodeWardrobe.create({ ...where, ...values }, { transaction });
  return [created, 'created'];
}

module.exports = { linkEpisodeWardrobe };

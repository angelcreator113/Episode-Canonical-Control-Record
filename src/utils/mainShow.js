'use strict';

/**
 * The main show (Evoni, 2026-10-19: "styling adventures with lala is the main
 * show any other show is bouncing of it"). The shows table has no main-show
 * marker, so it is the one live show whose slug is styling-adventures-with-lala
 * (or the older seed slug styling-adventure-lala) or whose name is Styling
 * Adventures with Lala, as migration 20261019200000-backfill-follower-labels
 * finds it. No such show, or more than one: null.
 *
 *   mainShowId(sequelize, { transaction })   the show's id, or null
 */

const MAIN_SHOW_SLUGS = Object.freeze(['styling-adventures-with-lala', 'styling-adventure-lala']);
const MAIN_SHOW_NAME = 'Styling Adventures with Lala';

async function mainShowId(sequelize, { transaction } = {}) {
  const [shows] = await sequelize.query(
    `SELECT id FROM shows
      WHERE deleted_at IS NULL AND (slug IN (:slugs) OR name ILIKE :name)
      ORDER BY id LIMIT 2`,
    { replacements: { slugs: MAIN_SHOW_SLUGS, name: MAIN_SHOW_NAME }, transaction });
  return shows.length === 1 ? shows[0].id : null;
}

module.exports = { mainShowId, MAIN_SHOW_SLUGS, MAIN_SHOW_NAME };

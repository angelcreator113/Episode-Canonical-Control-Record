'use strict';

/**
 * Episode viewer teaser (Task #2386; Evoni's rulings P12 and P13,
 * 2026-09-30).
 *
 * P12: "Each episode has a viewer teaser, separate from the event
 * description (guest copy, rule 12): mystery-driven, never revealing the
 * outcome, the hook in the first 150 characters. It's auto-drafted at Start
 * Episode from the event's concept and description, labelled Auto-drafted,
 * and editable. Distribution drafts platform copy from the teaser."
 * P13: "The existing episode description remains the internal synopsis of
 * what happens." (No change to episodes.description here.)
 *
 *   teaser         — the viewer teaser; null until drafted or written
 *   teaser_drafted — the saved copy of what Start Episode drafted. The UI
 *                    shows "Auto-drafted" while teaser equals it and
 *                    "Edited" once they differ (doctrine rule 14), the same
 *                    saved-copy convention as world_events'
 *                    automation.drafted_values. Never written by PUT.
 *
 * Both columns are nullable TEXT; no existing row changes meaning. episodes
 * already has deleted_at, so nothing else is added.
 *
 * Guarded: ADD COLUMN IF NOT EXISTS, skipped when the table is absent. down
 * removes only these two columns.
 */
const tableExists = async (queryInterface, table) => {
  const [rows] = await queryInterface.sequelize.query(
    'SELECT to_regclass(:name) AS reg',
    { replacements: { name: `public.${table}` } },
  );
  return Boolean(rows[0] && rows[0].reg);
};

module.exports = {
  async up(queryInterface) {
    if (!(await tableExists(queryInterface, 'episodes'))) return;
    await queryInterface.sequelize.query('ALTER TABLE episodes ADD COLUMN IF NOT EXISTS teaser TEXT');
    await queryInterface.sequelize.query('ALTER TABLE episodes ADD COLUMN IF NOT EXISTS teaser_drafted TEXT');
  },

  async down(queryInterface) {
    if (!(await tableExists(queryInterface, 'episodes'))) return;
    await queryInterface.sequelize.query('ALTER TABLE episodes DROP COLUMN IF EXISTS teaser_drafted');
    await queryInterface.sequelize.query('ALTER TABLE episodes DROP COLUMN IF EXISTS teaser');
  },
};

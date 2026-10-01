'use strict';

/**
 * A recurring location's approved permanent base image (ruling S6, Evoni
 * 2026-09-30, with her answers of 2026-10-01; EVENT_EPISODE_FLOW.md §8(dd)):
 * "A recurring location keeps one approved permanent base image;
 * event-dressed versions are made from it, so the place stays recognisable
 * across episodes." and "The approved base lives on the World Location (a
 * field naming its approved base image); migration accepted."
 *
 *   approved_base_scene_set_id  the scene set whose base is approved
 *   approved_base_image_url     that base image, as approved
 *   approved_base_at            when Evoni approved it
 *
 * All nullable with no default: nothing is approved automatically (answer
 * 4). ADD COLUMN IF NOT EXISTS, and skipped when the table is absent.
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
    if (!(await tableExists(queryInterface, 'world_locations'))) return;
    const q = (sql) => queryInterface.sequelize.query(sql);
    await q('ALTER TABLE world_locations ADD COLUMN IF NOT EXISTS approved_base_scene_set_id UUID');
    await q('ALTER TABLE world_locations ADD COLUMN IF NOT EXISTS approved_base_image_url TEXT');
    await q('ALTER TABLE world_locations ADD COLUMN IF NOT EXISTS approved_base_at TIMESTAMPTZ');
  },

  async down(queryInterface) {
    if (!(await tableExists(queryInterface, 'world_locations'))) return;
    const q = (sql) => queryInterface.sequelize.query(sql);
    await q('ALTER TABLE world_locations DROP COLUMN IF EXISTS approved_base_at');
    await q('ALTER TABLE world_locations DROP COLUMN IF EXISTS approved_base_image_url');
    await q('ALTER TABLE world_locations DROP COLUMN IF EXISTS approved_base_scene_set_id');
  },
};

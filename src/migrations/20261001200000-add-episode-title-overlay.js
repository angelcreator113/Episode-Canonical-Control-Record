'use strict';

/**
 * The episode title overlay (ruling P11 as amended, Evoni 2026-09-30): the
 * title set in real typefaces as a transparent PNG, with a chosen lettering
 * style, an optional backing band and an optional AI flourish
 * (episodeTitleOverlayService).
 *
 *   title_overlay_asset_id  the episode's current title overlay (assets.id)
 *   title_overlay_title     the title it was made for; outdated when it
 *                           differs from episodes.title
 *   title_overlay_style     { variant, band: { enabled, opacity },
 *                             flourish: { asset_id, url } | null }
 *
 * All three are nullable with no default, so existing episodes read as "no
 * overlay"; the framed card columns (20261001120000) are untouched.
 * ADD COLUMN IF NOT EXISTS, and skipped when the table is absent.
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
    const q = (sql) => queryInterface.sequelize.query(sql);
    await q('ALTER TABLE episodes ADD COLUMN IF NOT EXISTS title_overlay_asset_id UUID');
    await q('ALTER TABLE episodes ADD COLUMN IF NOT EXISTS title_overlay_title TEXT');
    await q('ALTER TABLE episodes ADD COLUMN IF NOT EXISTS title_overlay_style JSONB');
  },

  async down(queryInterface) {
    if (!(await tableExists(queryInterface, 'episodes'))) return;
    const q = (sql) => queryInterface.sequelize.query(sql);
    await q('ALTER TABLE episodes DROP COLUMN IF EXISTS title_overlay_style');
    await q('ALTER TABLE episodes DROP COLUMN IF EXISTS title_overlay_title');
    await q('ALTER TABLE episodes DROP COLUMN IF EXISTS title_overlay_asset_id');
  },
};

'use strict';

/**
 * Episode title approval and its title card (Task #2386, ruling P11,
 * Evoni 2026-09-30): "An episode title can be approved. Approving it offers
 * 'Design title card' with its cost shown. ... Changing an approved title
 * marks the card outdated and offers a redesign."
 *
 *   title_approved_at     when the title was approved (NULL = not approved)
 *   title_approved_value  the title as approved; the approval holds only
 *                         while it equals episodes.title
 *   title_card_asset_id   the episode's current title card (assets.id)
 *   title_card_title      the title that card was designed for; the card is
 *                         outdated when it differs from episodes.title
 *
 * All four are nullable with no default, so existing episodes read as "not
 * approved, no card". ADD COLUMN IF NOT EXISTS, and skipped when the table
 * is absent, so a re-run or a partial database never fails here.
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
    await q('ALTER TABLE episodes ADD COLUMN IF NOT EXISTS title_approved_at TIMESTAMP WITH TIME ZONE');
    await q('ALTER TABLE episodes ADD COLUMN IF NOT EXISTS title_approved_value TEXT');
    await q('ALTER TABLE episodes ADD COLUMN IF NOT EXISTS title_card_asset_id UUID');
    await q('ALTER TABLE episodes ADD COLUMN IF NOT EXISTS title_card_title TEXT');
  },

  async down(queryInterface) {
    if (!(await tableExists(queryInterface, 'episodes'))) return;
    const q = (sql) => queryInterface.sequelize.query(sql);
    await q('ALTER TABLE episodes DROP COLUMN IF EXISTS title_card_title');
    await q('ALTER TABLE episodes DROP COLUMN IF EXISTS title_card_asset_id');
    await q('ALTER TABLE episodes DROP COLUMN IF EXISTS title_approved_value');
    await q('ALTER TABLE episodes DROP COLUMN IF EXISTS title_approved_at');
  },
};

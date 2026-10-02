'use strict';

/**
 * scene_angles.angle_kind (Evoni's answer Q18, 2026-10-02;
 * docs/EVENT_EPISODE_FLOW.md §8(hh)):
 *
 *   Q18. "a new angle_kind field (exterior, entrance, main interior, …)
 *   beside the free label, filled for existing angles from their labels
 *   (ESTABLISHING → exterior, DOORWAY → entrance, WIDE → main interior)."
 *
 * angle_kind VARCHAR(30), nullable: exterior, entrance, main_interior, area,
 * detail or other (src/constants/beatLocations.js). The planner asks for
 * angles by kind (L4). Backfill, on live angles with no kind: the three
 * labels above; every other angle keeps no kind. Logs the count.
 *
 * Guarded: the column is added only when absent; the backfill touches only
 * angles with no kind, so a re-run changes nothing. down drops the column.
 */

const tableExists = async (sequelize, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: 'public.scene_angles' }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, transaction))) return;
      await sequelize.query('ALTER TABLE scene_angles ADD COLUMN IF NOT EXISTS angle_kind VARCHAR(30)', { transaction });
      const [, meta] = await sequelize.query(
        `UPDATE scene_angles SET angle_kind = CASE UPPER(angle_label)
             WHEN 'ESTABLISHING' THEN 'exterior'
             WHEN 'DOORWAY' THEN 'entrance'
             WHEN 'WIDE' THEN 'main_interior' END
          WHERE angle_kind IS NULL AND deleted_at IS NULL
            AND UPPER(angle_label) IN ('ESTABLISHING', 'DOORWAY', 'WIDE')`,
        { transaction });
      const count = typeof meta?.rowCount === 'number' ? meta.rowCount : 0;
      console.log(`[migration 20261002120000] angle kinds backfilled: ${count}`);
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (!(await tableExists(sequelize))) return;
    await sequelize.query('ALTER TABLE scene_angles DROP COLUMN IF EXISTS angle_kind');
  },
};

'use strict';

/**
 * scene_plans.chosen_by_user (Evoni's ruling L11, 2026-10-02;
 * docs/EVENT_EPISODE_FLOW.md §8(hh)):
 *
 *   L11. "A beat whose set or angle Evoni chose is marked 'Chosen by you'
 *   and is never replaced by a re-plan or by location changes, like a
 *   locked beat."
 *
 * BOOLEAN NOT NULL DEFAULT false. Set when Evoni chooses a beat's set or
 * angle in the beat editor; generateScenePlan and the Episode Locations
 * beat moves leave such a beat as it is. No backfill: no beat was chosen
 * this way before.
 *
 * Guarded: the column is added only when absent. down drops it.
 */

const tableExists = async (sequelize, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: 'public.scene_plans' }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, transaction))) return;
      await sequelize.query('ALTER TABLE scene_plans ADD COLUMN IF NOT EXISTS chosen_by_user BOOLEAN NOT NULL DEFAULT false', { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (!(await tableExists(sequelize))) return;
    await sequelize.query('ALTER TABLE scene_plans DROP COLUMN IF EXISTS chosen_by_user');
  },
};

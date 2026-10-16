'use strict';

/**
 * JustAWoman's LalaVerse profile (@justawoman) is removed (Evoni,
 * 2026-10-15: "remove it since Lala doesn't know she exists").
 *
 * Canon (docs/CANON.md): JustAWoman lives in her world and writes Lala's;
 * Lala does not know she exists. A locked @justawoman account in Lala's
 * feed put JustAWoman inside the LalaVerse. Her real-world feed
 * (feed_layer 'real_world') is not touched.
 *
 * Each LalaVerse row with is_justawoman_record = true is soft-deleted
 * (deleted_at, which every model query honors) and archived (status, for
 * raw SQL that reads status but not deleted_at). The row's prior status is
 * logged in justawoman_profile_removals; down restores exactly those rows.
 * The seeder that made it (20260314100000-justawoman-lalaverse-profile)
 * no longer inserts one.
 */

const LOG = 'justawoman_profile_removals';

const exists = async (sequelize, sql, replacements) => (await sequelize.query(sql, { replacements }))[0].length > 0;
const tableExists = (sequelize, name) => exists(sequelize, 'SELECT 1 FROM pg_class WHERE relname = :name', { name });

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    if (!(await tableExists(sequelize, 'social_profiles'))) return;

    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, LOG))) {
        await queryInterface.createTable(LOG, {
          id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
          profile_id: { type: Sequelize.INTEGER, allowNull: false },
          prior_status: { type: Sequelize.STRING(20), allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          deleted_at: { type: Sequelize.DATE, allowNull: true },
        }, { transaction });
      }

      const [rows] = await sequelize.query(
        `SELECT id, status::text AS status FROM social_profiles
          WHERE is_justawoman_record = true
            AND feed_layer::text = 'lalaverse'
            AND deleted_at IS NULL
          ORDER BY id`, { transaction });
      for (const r of rows) {
        await sequelize.query(
          `INSERT INTO ${LOG} (profile_id, prior_status, created_at, updated_at) VALUES (:id, :status, NOW(), NOW())`,
          { replacements: { id: r.id, status: r.status }, transaction });
        await sequelize.query(
          `UPDATE social_profiles SET deleted_at = NOW(), status = 'archived', updated_at = NOW() WHERE id = :id`,
          { replacements: { id: r.id }, transaction });
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (!(await tableExists(sequelize, LOG))) return;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, 'social_profiles')) {
        await sequelize.query(
          `UPDATE social_profiles sp
              SET deleted_at = NULL,
                  status = COALESCE(l.prior_status, 'finalized')::"enum_social_profiles_status",
                  updated_at = NOW()
             FROM ${LOG} l
            WHERE l.profile_id = sp.id AND l.deleted_at IS NULL`, { transaction });
      }
      await queryInterface.dropTable(LOG, { transaction });
    });
  },
};

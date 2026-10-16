'use strict';

/**
 * Crossed characters no longer carry JustAWoman's cost as their own wound
 * (Evoni, 2026-10-16: "yes do A").
 *
 * POST /social-profiles/:id/cross created the character with
 *   core_desire ← social_profiles.parasocial_function
 *   core_wound  ← social_profiles.what_it_costs_her
 * Both say what the profile does to JustAWoman, not what the character
 * wants or carries, and the inner-life generator reads core_* as canon. The
 * route now leaves them empty (author notes on her real-world feed).
 *
 * Here a character's core_desire / core_wound is cleared only while it is
 * still exactly the copy of its feed profile's field, so anything Evoni wrote
 * or changed stays. The values stay on the feed profile. Each clear is logged
 * in registry_copied_core_clears; down puts exactly those back.
 */

const LOG = 'registry_copied_core_clears';
const PAIRS = [
  ['core_desire', 'parasocial_function'],
  ['core_wound', 'what_it_costs_her'],
];

const exists = async (sequelize, sql, replacements) => (await sequelize.query(sql, { replacements }))[0].length > 0;
const tableExists = (sequelize, name) => exists(sequelize, 'SELECT 1 FROM pg_class WHERE relname = :name', { name });
const columnExists = (sequelize, table, column) => exists(sequelize,
  'SELECT 1 FROM information_schema.columns WHERE table_name = :table AND column_name = :column', { table, column });

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    if (!(await tableExists(sequelize, 'registry_characters')) || !(await tableExists(sequelize, 'social_profiles'))) return;

    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, LOG))) {
        await queryInterface.createTable(LOG, {
          id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
          character_id: { type: Sequelize.UUID, allowNull: false },
          field: { type: Sequelize.STRING(40), allowNull: false },
          value: { type: Sequelize.TEXT, allowNull: false },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          deleted_at: { type: Sequelize.DATE, allowNull: true },
        }, { transaction });
      }

      for (const [field, source] of PAIRS) {
        if (!(await columnExists(sequelize, 'registry_characters', field))) continue;
        if (!(await columnExists(sequelize, 'social_profiles', source))) continue;
        const [rows] = await sequelize.query(
          `SELECT rc.id, rc.${field} AS value
             FROM registry_characters rc
             JOIN social_profiles sp ON sp.id = rc.feed_profile_id
            WHERE rc.deleted_at IS NULL
              AND rc.${field} IS NOT NULL AND BTRIM(rc.${field}) <> ''
              AND rc.${field} = sp.${source}`,
          { transaction });
        for (const row of rows) {
          await sequelize.query(
            `INSERT INTO ${LOG} (character_id, field, value, created_at, updated_at) VALUES (:id, :field, :value, NOW(), NOW())`,
            { replacements: { id: row.id, field, value: row.value }, transaction });
          await sequelize.query(`UPDATE registry_characters SET ${field} = NULL WHERE id = :id`,
            { replacements: { id: row.id }, transaction });
        }
        console.log(`[migration 20261016060000] cleared ${rows.length} copied ${field} value(s)`);
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (!(await tableExists(sequelize, LOG))) return;
    await sequelize.transaction(async (transaction) => {
      const [rows] = await sequelize.query(`SELECT character_id, field, value FROM ${LOG} WHERE deleted_at IS NULL`, { transaction });
      for (const row of rows) {
        if (!PAIRS.some(([f]) => f === row.field)) continue;
        await sequelize.query(
          `UPDATE registry_characters SET ${row.field} = :value WHERE id = :id AND ${row.field} IS NULL`,
          { replacements: { id: row.character_id, value: row.value }, transaction });
      }
      await queryInterface.dropTable(LOG, { transaction });
    });
  },
};

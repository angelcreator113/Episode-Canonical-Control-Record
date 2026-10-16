'use strict';

/**
 * Lala is not human (Evoni, 2026-10-16: "yes do ... B"; docs/CANON.md: Lala
 * is a sentient fashion game and AI character JustAWoman created).
 *
 * seed-book1 and the species default gave every character 'human', Lala
 * included. Here a character keyed 'lala' whose species is still 'human' (or
 * empty) becomes 'sentient AI', the value seed-book1 now writes
 * (characterRegistry.js LALA_SPECIES). A species anyone chose stays. down
 * puts 'human' back on exactly those rows (logged in lala_species_fixes).
 */

const LOG = 'lala_species_fixes';
const SPECIES = 'sentient AI';

const exists = async (sequelize, sql, replacements) => (await sequelize.query(sql, { replacements }))[0].length > 0;
const tableExists = (sequelize, name) => exists(sequelize, 'SELECT 1 FROM pg_class WHERE relname = :name', { name });
const columnExists = (sequelize, table, column) => exists(sequelize,
  'SELECT 1 FROM information_schema.columns WHERE table_name = :table AND column_name = :column', { table, column });

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    if (!(await tableExists(sequelize, 'registry_characters'))) return;
    if (!(await columnExists(sequelize, 'registry_characters', 'species'))) return;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, LOG))) {
        await queryInterface.createTable(LOG, {
          id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
          character_id: { type: Sequelize.UUID, allowNull: false },
          from_species: { type: Sequelize.STRING(150), allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          deleted_at: { type: Sequelize.DATE, allowNull: true },
        }, { transaction });
      }
      const [rows] = await sequelize.query(
        `SELECT id, species FROM registry_characters
          WHERE LOWER(character_key) = 'lala' AND deleted_at IS NULL
            AND (species IS NULL OR BTRIM(species) = '' OR LOWER(species) = 'human')`, { transaction });
      for (const row of rows) {
        await sequelize.query(`INSERT INTO ${LOG} (character_id, from_species, created_at, updated_at) VALUES (:id, :from, NOW(), NOW())`,
          { replacements: { id: row.id, from: row.species }, transaction });
        await sequelize.query('UPDATE registry_characters SET species = :species WHERE id = :id',
          { replacements: { id: row.id, species: SPECIES }, transaction });
      }
      console.log(`[migration 20261016070000] Lala's species set on ${rows.length} character(s)`);
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (!(await tableExists(sequelize, LOG))) return;
    await sequelize.transaction(async (transaction) => {
      await sequelize.query(
        `UPDATE registry_characters rc SET species = l.from_species
           FROM ${LOG} l WHERE l.character_id = rc.id AND l.deleted_at IS NULL AND rc.species = :species`,
        { replacements: { species: SPECIES }, transaction });
      await queryInterface.dropTable(LOG, { transaction });
    });
  },
};

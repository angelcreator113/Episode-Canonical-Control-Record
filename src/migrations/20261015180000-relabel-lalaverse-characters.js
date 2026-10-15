'use strict';

/**
 * Lala's-world characters stored as Book 1 are relabeled 'lalaverse'
 * (Evoni, 2026-10-15: "fix it").
 *
 * POST /registries/:id/characters gave every new character world 'book-1'
 * unless the caller named one, so characters of the show's registries read
 * as JustAWoman's world. The route now takes the registry's world
 * (characterRegistry.js worldForNewCharacter). Canon (Evoni, 2026-10-15):
 * JustAWoman lives in her world and writes Lala's; Lala is a sentient
 * fashion game and AI character JustAWoman created, and does not know.
 *
 * Only a character proven to be Lala's is moved, since JustAWoman and her
 * people rightly stay 'book-1' wherever their registry is:
 *   - its feed profile (registry_characters.feed_profile_id, ruling C3) is a
 *     LalaVerse profile (social_profiles.feed_layer = 'lalaverse'), or
 *   - it is Lala (character_key 'lala').
 * The Book 1 registry (book_tag "Book 1 · Before Lala") is never touched.
 *
 * Each move is logged in registry_world_relabels; down puts exactly those
 * back to 'book-1'.
 */

const LOG = 'registry_world_relabels';

const exists = async (sequelize, sql, replacements) => (await sequelize.query(sql, { replacements }))[0].length > 0;
const tableExists = (sequelize, name) => exists(sequelize, 'SELECT 1 FROM pg_class WHERE relname = :name', { name });
const columnExists = (sequelize, table, column) => exists(sequelize,
  'SELECT 1 FROM information_schema.columns WHERE table_name = :table AND column_name = :column', { table, column });

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    if (!(await tableExists(sequelize, 'registry_characters'))) return;
    if (!(await columnExists(sequelize, 'registry_characters', 'world'))) return;

    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, LOG))) {
        await queryInterface.createTable(LOG, {
          id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
          character_id: { type: Sequelize.UUID, allowNull: false },
          from_world: { type: Sequelize.STRING(20), allowNull: false },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          deleted_at: { type: Sequelize.DATE, allowNull: true },
        }, { transaction });
      }

      const hasProfiles = await tableExists(sequelize, 'social_profiles');
      const [rows] = await sequelize.query(
        `SELECT rc.id
           FROM registry_characters rc
           LEFT JOIN character_registries cr ON cr.id = rc.registry_id
           ${hasProfiles ? 'LEFT JOIN social_profiles sp ON sp.id = rc.feed_profile_id' : ''}
          WHERE rc.world::text = 'book-1'
            AND rc.deleted_at IS NULL
            AND COALESCE(cr.book_tag, '') !~* '(book\\s*1|before lala)'
            AND (LOWER(rc.character_key) = 'lala'
                 ${hasProfiles ? "OR sp.feed_layer::text = 'lalaverse'" : ''})`,
        { transaction });

      for (const r of rows) {
        await sequelize.query(
          `UPDATE registry_characters SET world = 'lalaverse', updated_at = NOW() WHERE id = :id`,
          { replacements: { id: r.id }, transaction });
        await sequelize.query(
          `INSERT INTO ${LOG} (character_id, from_world) VALUES (:id, 'book-1')`,
          { replacements: { id: r.id }, transaction });
      }
      console.log(`[migration 20261015180000] relabeled ${rows.length} Lala's-world character(s) from book-1 to lalaverse.`);
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (!(await tableExists(sequelize, LOG))) return;
    await sequelize.transaction(async (transaction) => {
      await sequelize.query(
        `UPDATE registry_characters rc SET world = 'book-1', updated_at = NOW()
           FROM ${LOG} l
          WHERE l.character_id = rc.id AND l.deleted_at IS NULL AND rc.world::text = 'lalaverse'`,
        { transaction });
      await queryInterface.dropTable(LOG, { transaction });
    });
  },
};

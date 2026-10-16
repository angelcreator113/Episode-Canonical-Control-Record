'use strict';

/**
 * A book chapter names the episode it belongs to (Evoni, 2026-10-15).
 *
 * The book follows the show (docs/CANON.md): the episode is what the
 * viewer sees, the short story (stories, format 'short_story', by
 * episode_id) is the event in full, and the chapter is everything the
 * viewer does not see, in JustAWoman's point of view. storyteller_chapters
 * gains episode_id so a chapter can be written from its episode and checked
 * against its short story, and the book's ledger can show what each
 * episode still owes. Nullable: chapters written before this, and ones not
 * tied to an episode, have none.
 */

const exists = async (sequelize, sql, replacements) => (await sequelize.query(sql, { replacements }))[0].length > 0;
const columnExists = (sequelize, table, column) => exists(sequelize,
  'SELECT 1 FROM information_schema.columns WHERE table_name = :table AND column_name = :column', { table, column });
const tableExists = (sequelize, name) => exists(sequelize, 'SELECT 1 FROM pg_class WHERE relname = :name', { name });

const INDEX = 'idx_storyteller_chapters_episode';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    if (!(await tableExists(sequelize, 'storyteller_chapters'))) return;
    if (!(await columnExists(sequelize, 'storyteller_chapters', 'episode_id'))) {
      await queryInterface.addColumn('storyteller_chapters', 'episode_id', { type: Sequelize.UUID, allowNull: true });
    }
    await sequelize.query(`CREATE INDEX IF NOT EXISTS ${INDEX} ON storyteller_chapters (episode_id)`);
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (!(await tableExists(sequelize, 'storyteller_chapters'))) return;
    await sequelize.query(`DROP INDEX IF EXISTS ${INDEX}`);
    if (await columnExists(sequelize, 'storyteller_chapters', 'episode_id')) {
      await queryInterface.removeColumn('storyteller_chapters', 'episode_id');
    }
  },
};

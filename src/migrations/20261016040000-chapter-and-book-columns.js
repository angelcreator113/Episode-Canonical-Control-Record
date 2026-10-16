'use strict';

/**
 * Columns the models declare that no migration created (schema agreement
 * step 2, scripts/schema-agreement-step2.baseline):
 *   storyteller_chapters.sections          JSONB         (StorytellerChapter)
 *   storyteller_chapters.chapter_template  VARCHAR(100)  (StorytellerChapter)
 *   storyteller_books.theme, pov, tone, setting, conflict, stakes
 *                                          TEXT          (StorytellerBook)
 *
 * Production has all of them, with these types (pov is text there too):
 * docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt. They were
 * added outside the migration tree, so a database built from the migrations
 * alone lacked them and StorytellerChapter.create failed there ('column
 * "sections" of relation "storyteller_chapters" does not exist', found
 * 2026-10-15).
 *
 * up adds each only when missing, so it changes nothing in production.
 * down removes nothing: in production these columns predate this migration
 * and hold Evoni's data, so undoing it must not drop them.
 */

const COLUMNS = [
  ['storyteller_chapters', 'sections', (S) => ({ type: S.JSONB, allowNull: true })],
  ['storyteller_chapters', 'chapter_template', (S) => ({ type: S.STRING(100), allowNull: true })],
  ...['theme', 'pov', 'tone', 'setting', 'conflict', 'stakes']
    .map((column) => ['storyteller_books', column, (S) => ({ type: S.TEXT, allowNull: true })]),
];

const exists = async (sequelize, sql, replacements) => (await sequelize.query(sql, { replacements }))[0].length > 0;

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    for (const [table, column, def] of COLUMNS) {
      if (!(await exists(sequelize, 'SELECT 1 FROM pg_class WHERE relname = :table', { table }))) continue;
      if (await exists(sequelize,
        'SELECT 1 FROM information_schema.columns WHERE table_name = :table AND column_name = :column', { table, column })) continue;
      await queryInterface.addColumn(table, column, def(Sequelize));
    }
  },

  async down() {
    // Intentionally nothing: see the header.
  },
};

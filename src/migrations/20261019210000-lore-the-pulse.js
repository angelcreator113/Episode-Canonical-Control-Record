'use strict';

/**
 * The LalaVerse's seeded lore calls its social web The Pulse, not the Feed
 * (Evoni, 2026-10-19: "add the fix").
 *
 * The lore branch renamed "the Feed" in the franchise-law and cultural-calendar
 * seeders, but those only seed a fresh database. Rows already written keep the
 * old words, and every generator reads them (franchise_knowledge is injected
 * into prompts), so old canon said "the Feed" while new writing says "The Pulse".
 *
 * Rows: franchise_knowledge of the LalaVerse source documents those seeders
 * write (title, content), and the system cultural calendar
 * (story_calendar_events logged_by 'system', event_type 'lalaverse_cultural':
 * title, what_world_knows, what_only_we_know, activities, phrases).
 *
 * Only these whole phrases change (word boundaries, so "the Feedback" and
 * "Instagram Feed" stay): "Feed Behavior", "Feed profile", "the Feed",
 * "The Feed". JustAWoman's real-world feed is never in these rows.
 *
 * Every changed value is kept first in lore_pulse_rename_backups, so up is
 * safe to run twice (a row already renamed has nothing left to change) and
 * down restores the exact old text. A Brain Update card whose words change
 * shows once as changed in the next preview (its source_hash is of the old
 * text), as in 20261008110000-franchise-laws-dream-city-names.
 */

const BACKUPS = 'lore_pulse_rename_backups';

const RENAMES = [
  ['\\mFeed Behavior\\M', 'Pulse Behavior'],
  ['\\mFeed profile\\M', 'Pulse profile'],
  ['\\m[Tt]he Feed\\M', 'The Pulse'],
];

const SOURCE_DOCUMENTS = [
  'cultural-system-v1.0',
  'cultural-system-v2.0',
  'influencer-systems-v1.0',
  'world-infrastructure-v1.0',
  'social-timeline-v1.0',
  'social-personality-v1.0',
  'character-life-simulation-v1.0',
  'cultural-memory-v1.0',
  'character-depth-engine-v1.0',
  'show-brain-v1.0',
  'embodied-life-rules-v1.0',
];

// The tables, the text columns to rename, and which of their rows are the seeded lore.
const TARGETS = [
  {
    table: 'franchise_knowledge',
    columns: ['title', 'content'],
    where: 'source_document IN (:docs)',
  },
  {
    table: 'story_calendar_events',
    columns: ['title', 'what_world_knows', 'what_only_we_know', 'activities', 'phrases'],
    where: "logged_by = 'system' AND event_type = 'lalaverse_cultural'",
  },
];

const PATTERN = '\\m(Feed Behavior|Feed profile|[Tt]he Feed)\\M';

/** The SQL text of a column, renamed: REPLACE by regex for each phrase, in order. */
function renamed(expr) {
  return RENAMES.reduce((acc, [from, to]) => `regexp_replace(${acc}, '${from}', '${to}', 'g')`, expr);
}

async function columnTypes(sequelize, table, transaction) {
  const [rows] = await sequelize.query(
    `SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = :table`,
    { replacements: { table }, transaction });
  return new Map(rows.map((r) => [r.column_name, r.data_type]));
}

module.exports = {
  RENAMES,
  SOURCE_DOCUMENTS,

  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(BACKUPS, {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        table_name: { type: Sequelize.STRING(64), allowNull: false },
        row_id: { type: Sequelize.STRING(64), allowNull: false },
        column_name: { type: Sequelize.STRING(64), allowNull: false },
        old_value: { type: Sequelize.TEXT, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      }, { transaction }).catch((err) => {
        // A second run finds the table; anything else is a real failure.
        if (!/already exists/i.test(err.message)) throw err;
      });

      const counts = {};
      for (const target of TARGETS) {
        const types = await columnTypes(sequelize, target.table, transaction);
        if (!types.size) {
          console.log(`[lore-the-pulse] ${target.table} does not exist; skipped`);
          continue;
        }
        let changed = 0;
        for (const column of target.columns) {
          if (!types.has(column)) continue;
          const isJson = types.get(column) === 'jsonb' || types.get(column) === 'json';
          const text = isJson ? `${column}::text` : column;
          const back = isJson ? `(${renamed(text)})::${types.get(column)}` : renamed(text);
          const match = `${column} IS NOT NULL AND ${text} ~ '${PATTERN}' AND ${target.where}`;
          await sequelize.query(
            `INSERT INTO ${BACKUPS} (table_name, row_id, column_name, old_value, created_at, updated_at)
             SELECT '${target.table}', id::text, '${column}', ${text}, NOW(), NOW()
               FROM ${target.table} WHERE ${match}`,
            { replacements: { docs: SOURCE_DOCUMENTS }, transaction });
          const [, meta] = await sequelize.query(
            `UPDATE ${target.table} SET ${column} = ${back}, updated_at = NOW() WHERE ${match}`,
            { replacements: { docs: SOURCE_DOCUMENTS }, transaction });
          changed += (meta && typeof meta.rowCount === 'number') ? meta.rowCount : 0;
        }
        counts[target.table] = changed;
      }
      console.log(`[lore-the-pulse] renamed "the Feed" to "The Pulse": ${JSON.stringify(counts)} (values changed per table)`);
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const [exists] = await sequelize.query('SELECT to_regclass(:t) AS reg', { replacements: { t: `public.${BACKUPS}` }, transaction });
      if (!exists[0] || !exists[0].reg) return;
      for (const target of TARGETS) {
        const types = await columnTypes(sequelize, target.table, transaction);
        for (const column of target.columns) {
          if (!types.has(column)) continue;
          const isJson = types.get(column) === 'jsonb' || types.get(column) === 'json';
          const old = isJson ? `b.old_value::${types.get(column)}` : 'b.old_value';
          // The earliest backup per row and column is the text before any run.
          await sequelize.query(
            `UPDATE ${target.table} t SET ${column} = ${old}, updated_at = NOW()
               FROM (SELECT DISTINCT ON (row_id) row_id, old_value FROM ${BACKUPS}
                      WHERE table_name = '${target.table}' AND column_name = '${column}' AND deleted_at IS NULL
                      ORDER BY row_id, id) b
              WHERE t.id::text = b.row_id`,
            { transaction });
        }
      }
      await queryInterface.dropTable(BACKUPS, { transaction });
    });
  },
};

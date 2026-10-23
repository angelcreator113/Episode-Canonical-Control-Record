'use strict';

/**
 * The "What changed" card (Evoni, 2026-10-23: approved plan "from a finished
 * script to the story to the next episode", PR 2). The app reads the
 * finished script and proposes what changed; she ticks, edits or drops each
 * item, and Save writes it (services/episodeStoryRecord approveRecord).
 *
 * On episode_story_records, JSONB lists beside characters/secrets/threads:
 *   relationships  [{ key, a, b, type, is_romantic, stage_before, stage_after,
 *                     tension_before, tension_after, evidence_beat, note, keep }]
 *   follow_ups     [{ key, person, name, text, due_hint, keep }]
 *   goals          [{ key, slot, label, covered, beat, note, keep }]
 *   twists         [] (a later PR fills it)
 *   applied        { <kind>: { <item key>: what was written } }: Save skips
 *                  what it already wrote, so a second Save creates nothing
 *
 * New table show_follow_ups: what Lala owes someone after an episode, open
 * until a later episode does it (or Evoni drops it).
 *   show_id, from_episode_id, profile_id (social_profiles, nullable),
 *   registry_character_id (nullable), text, due_hint,
 *   status open | done | dropped, done_episode_id, created_by,
 *   timestamps, deleted_at; index (show_id, status).
 *
 * Raw SQL in services/episodeStoryRecord; no model. Guarded: each column and
 * the table only when absent. down drops the table and the columns.
 */

const RECORDS = 'episode_story_records';
const FOLLOW_UPS = 'show_follow_ups';
const LISTS = ['relationships', 'follow_ups', 'goals', 'twists'];

const tableExists = async (sequelize, name, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${name}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, RECORDS, transaction)) {
        const cols = await queryInterface.describeTable(RECORDS, { transaction });
        for (const col of LISTS) {
          if (!cols[col]) {
            await queryInterface.addColumn(RECORDS, col,
              { type: Sequelize.JSONB, allowNull: false, defaultValue: Sequelize.literal("'[]'::jsonb") }, { transaction });
          }
        }
        if (!cols.applied) {
          await queryInterface.addColumn(RECORDS, 'applied',
            { type: Sequelize.JSONB, allowNull: false, defaultValue: Sequelize.literal("'{}'::jsonb") }, { transaction });
        }
      }

      if (!(await tableExists(sequelize, FOLLOW_UPS, transaction))) {
        await queryInterface.createTable(FOLLOW_UPS, {
          id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
          show_id: { type: Sequelize.UUID, allowNull: false },
          from_episode_id: { type: Sequelize.UUID, allowNull: true },
          profile_id: { type: Sequelize.INTEGER, allowNull: true },
          registry_character_id: { type: Sequelize.UUID, allowNull: true },
          text: { type: Sequelize.TEXT, allowNull: false },
          due_hint: { type: Sequelize.STRING(200), allowNull: true },
          status: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'open' },
          done_episode_id: { type: Sequelize.UUID, allowNull: true },
          created_by: { type: Sequelize.STRING(255), allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          deleted_at: { type: Sequelize.DATE, allowNull: true },
        }, { transaction });
      }
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS ${FOLLOW_UPS}_show_status ON ${FOLLOW_UPS} (show_id, status)`, { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, FOLLOW_UPS, transaction)) await queryInterface.dropTable(FOLLOW_UPS, { transaction });
      if (await tableExists(sequelize, RECORDS, transaction)) {
        const cols = await queryInterface.describeTable(RECORDS, { transaction });
        for (const col of [...LISTS, 'applied']) {
          if (cols[col]) await queryInterface.removeColumn(RECORDS, col, { transaction });
        }
      }
    });
  },
};

'use strict';

/**
 * A role for each of an episode's scene sets (Evoni's rulings L3 and L6,
 * 2026-10-02, and her answer to Q15; docs/EVENT_EPISODE_FLOW.md §8(hh)):
 *
 *   L6. "An episode can have any number of scene sets, each with a role
 *   (home, closet, event, or an extra location such as a car or café).
 *   They're chosen together in the Episode Locations step and can be added
 *   or changed while the episode is a draft."
 *   Q15. "roles are home, closet, event (one) and extra; any number of
 *   extras, each with a free name (per L6)."
 *
 * 1. scene_set_episodes.role (VARCHAR(20), nullable): home, closet, event or
 *    extra. scene_set_episodes.role_name (VARCHAR(80), nullable): an extra's
 *    free name ("Car", "Café").
 * 2. Backfill, on live links with no role, in this order:
 *    - the set the episode's event uses (world_events.scene_set_id, the
 *      event whose used_in_episode_id is the episode) is its event;
 *    - the first HOME_BASE set by sort_order is its home;
 *    - the first CLOSET set by sort_order is its closet;
 *    - every other link is an extra named after its set.
 *    Logs each count.
 *
 * Guarded: the columns are added only when absent; the backfill touches only
 * links with no role, so a re-run changes nothing. down drops both columns.
 */

const TABLE = 'scene_set_episodes';

const tableExists = async (sequelize, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${TABLE}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

const hasColumn = async (sequelize, column, transaction) => {
  const [cols] = await sequelize.query(
    'SELECT 1 FROM information_schema.columns WHERE table_name = :table AND column_name = :column',
    { replacements: { table: TABLE, column }, transaction });
  return cols.length > 0;
};

const rowCount = (meta) => (typeof meta?.rowCount === 'number' ? meta.rowCount : 0);

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, transaction))) return;
      if (!(await hasColumn(sequelize, 'role', transaction))) {
        await queryInterface.addColumn(TABLE, 'role', { type: Sequelize.STRING(20), allowNull: true }, { transaction });
      }
      if (!(await hasColumn(sequelize, 'role_name', transaction))) {
        await queryInterface.addColumn(TABLE, 'role_name', { type: Sequelize.STRING(80), allowNull: true }, { transaction });
      }

      const [, ev] = await sequelize.query(
        `UPDATE scene_set_episodes l SET role = 'event'
           FROM world_events e
          WHERE l.role IS NULL AND l.deleted_at IS NULL
            AND e.used_in_episode_id = l.episode_id AND e.scene_set_id = l.scene_set_id AND e.deleted_at IS NULL`,
        { transaction });

      const firstOfType = async (role, sceneType) => {
        const [, meta] = await sequelize.query(
          `UPDATE scene_set_episodes l SET role = :role
             FROM (
               SELECT DISTINCT ON (l2.episode_id) l2.id
                 FROM scene_set_episodes l2 JOIN scene_sets s ON s.id = l2.scene_set_id
                WHERE l2.role IS NULL AND l2.deleted_at IS NULL AND s.scene_type = :sceneType
                  AND NOT EXISTS (SELECT 1 FROM scene_set_episodes x
                                   WHERE x.episode_id = l2.episode_id AND x.role = :role AND x.deleted_at IS NULL)
                ORDER BY l2.episode_id, l2.sort_order ASC, l2.created_at ASC
             ) pick
            WHERE l.id = pick.id`,
          { replacements: { role, sceneType }, transaction });
        return rowCount(meta);
      };
      const homes = await firstOfType('home', 'HOME_BASE');
      const closets = await firstOfType('closet', 'CLOSET');

      const [, extras] = await sequelize.query(
        `UPDATE scene_set_episodes l SET role = 'extra', role_name = LEFT(s.name, 80)
           FROM scene_sets s
          WHERE l.role IS NULL AND l.deleted_at IS NULL AND s.id = l.scene_set_id`,
        { transaction });

      console.log(`[migration 20261002100000] roles backfilled: ${rowCount(ev)} event, ${homes} home, ${closets} closet, ${rowCount(extras)} extra`);
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (!(await tableExists(sequelize))) return;
    if (await hasColumn(sequelize, 'role_name')) await queryInterface.removeColumn(TABLE, 'role_name');
    if (await hasColumn(sequelize, 'role')) await queryInterface.removeColumn(TABLE, 'role');
  },
};

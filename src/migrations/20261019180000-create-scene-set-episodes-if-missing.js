'use strict';

/**
 * scene_set_episodes on a database built from scratch (found by the local
 * end-to-end check, 2026-10-19).
 *
 * 20260324000000-add-scene-sets-cover-and-episodes creates this join table,
 * but only once scene_sets exists, and scene_sets is created later, by
 * 20260625000000-create-scene-sets-and-angles. On a fresh database the
 * earlier migration skips, is recorded as run, and the table is never made;
 * 20260626000001 (sort_order) and 20261002100000 (role, role_name) then skip
 * too. Every read of a scene set with its episodes (GET /scene-sets/:id, the
 * Places & Gallery tab) answers 500 "relation scene_set_episodes does not
 * exist". A database that ran the migrations in their old order already has
 * the table.
 *
 * Guarded: creates the table, in the shape those three migrations leave it
 * (and the SceneSetEpisode model reads), only when it is absent. Where it
 * exists nothing changes. down is a no-op: this migration cannot tell a table
 * it made from one that holds live links, and never drops the latter.
 */

const TABLE = 'scene_set_episodes';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${TABLE}` } });
    if (rows[0] && rows[0].reg) {
      console.log(`[create-scene-set-episodes-if-missing] ${TABLE} exists; nothing to do`);
      return;
    }
    await queryInterface.createTable(TABLE, {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      scene_set_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'scene_sets', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      episode_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'episodes', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      role: { type: Sequelize.STRING(20), allowNull: true },
      role_name: { type: Sequelize.STRING(80), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex(TABLE, ['scene_set_id', 'episode_id'], {
      unique: true,
      where: { deleted_at: null },
      name: 'scene_set_episodes_unique_pair',
    });
    console.log(`[create-scene-set-episodes-if-missing] created ${TABLE}`);
  },

  async down() {
    // Deliberately empty: see the header.
  },
};

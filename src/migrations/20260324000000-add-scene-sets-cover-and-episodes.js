'use strict';

/**
 * Migration: Add cover_angle_id to scene_sets + create scene_set_episodes join table
 *
 * - cover_angle_id: persists the user's chosen "hero" angle for each scene set
 * - scene_set_episodes: many-to-many link between scene sets and episodes
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ── cover_angle_id on scene_sets ─────────────────────────────────────
    const setTable = await queryInterface.describeTable('scene_sets').catch(() => null);
    if (!setTable) {
      console.log('scene_sets table does not exist — skipping migration');
      return;
    }

    const anglesTable = await queryInterface.describeTable('scene_angles').catch(() => null);
    if (setTable && !setTable.cover_angle_id) {
      await queryInterface.addColumn('scene_sets', 'cover_angle_id', {
        type: Sequelize.UUID,
        allowNull: true,
        ...(anglesTable ? {
          references: { model: 'scene_angles', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        } : {}),
      });
    }

    // ── scene_set_episodes join table ────────────────────────────────────
    const episodesTable = await queryInterface.describeTable('episodes').catch(() => null);
    const joinExists = await queryInterface.describeTable('scene_set_episodes').catch(() => null);
    if (!joinExists) {
      await queryInterface.createTable('scene_set_episodes', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        scene_set_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'scene_sets', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        episode_id: {
          type: Sequelize.UUID,
          allowNull: false,
          ...(episodesTable ? {
            references: { model: 'episodes', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          } : {}),
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
        },
        deleted_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
      });

      await queryInterface.addIndex('scene_set_episodes', ['scene_set_id', 'episode_id'], {
        unique: true,
        where: { deleted_at: null },
        name: 'scene_set_episodes_unique_pair',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('scene_set_episodes').catch(() => {});
    await queryInterface.removeColumn('scene_sets', 'cover_angle_id').catch(() => {});
  },
};

'use strict';

/**
 * Migration: Add platform fields to episodes, ui_elements/dialogue_clips to scenes,
 * and create timeline_data table for Scene Composer & Timeline Editor integration.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // ── 1. Add platform fields to episodes ──
      const [episodeCols] = await queryInterface.sequelize.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'episodes' AND column_name IN ('platform', 'width', 'height', 'aspect_ratio')`,
        { transaction }
      );
      const existingEpCols = episodeCols.map(r => r.column_name);

      if (!existingEpCols.includes('platform')) {
        await queryInterface.addColumn('episodes', 'platform', {
          type: Sequelize.STRING(20),
          allowNull: true,
          defaultValue: 'youtube'
        }, { transaction });
      }
      if (!existingEpCols.includes('width')) {
        await queryInterface.addColumn('episodes', 'width', {
          type: Sequelize.INTEGER,
          allowNull: true,
          defaultValue: 1920
        }, { transaction });
      }
      if (!existingEpCols.includes('height')) {
        await queryInterface.addColumn('episodes', 'height', {
          type: Sequelize.INTEGER,
          allowNull: true,
          defaultValue: 1080
        }, { transaction });
      }
      if (!existingEpCols.includes('aspect_ratio')) {
        await queryInterface.addColumn('episodes', 'aspect_ratio', {
          type: Sequelize.STRING(10),
          allowNull: true,
          defaultValue: '16:9'
        }, { transaction });
      }

      // Add index on platform (use raw SQL with IF NOT EXISTS)
      await queryInterface.sequelize.query(
        'CREATE INDEX IF NOT EXISTS idx_episodes_platform ON episodes(platform)',
        { transaction }
      );

      // ── 2. Add ui_elements and dialogue_clips to scenes ──
      const [sceneCols] = await queryInterface.sequelize.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'scenes' AND column_name IN ('ui_elements', 'dialogue_clips')`,
        { transaction }
      );
      const existingSceneCols = sceneCols.map(r => r.column_name);

      if (!existingSceneCols.includes('ui_elements')) {
        await queryInterface.addColumn('scenes', 'ui_elements', {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: []
        }, { transaction });
      }
      if (!existingSceneCols.includes('dialogue_clips')) {
        await queryInterface.addColumn('scenes', 'dialogue_clips', {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: []
        }, { transaction });
      }

      // ── 3. Create timeline_data table ──
      const [tableCheck] = await queryInterface.sequelize.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'timeline_data'
        ) as exists`,
        { transaction }
      );

      if (!tableCheck[0].exists) {
        await queryInterface.createTable('timeline_data', {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            defaultValue: Sequelize.literal('gen_random_uuid()')
          },
          episode_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'episodes', key: 'id' },
            onDelete: 'CASCADE',
            unique: true
          },
          beats: {
            type: Sequelize.JSONB,
            allowNull: true,
            defaultValue: []
          },
          markers: {
            type: Sequelize.JSONB,
            allowNull: true,
            defaultValue: []
          },
          audio_clips: {
            type: Sequelize.JSONB,
            allowNull: true,
            defaultValue: []
          },
          character_clips: {
            type: Sequelize.JSONB,
            allowNull: true,
            defaultValue: []
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
          }
        }, { transaction });

        await queryInterface.addIndex('timeline_data', ['episode_id'], {
          name: 'idx_timeline_episode',
          unique: true,
          transaction
        });
      }

      // ── 4. Create updated_at trigger ──
      await queryInterface.sequelize.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `, { transaction });

      // Trigger for timeline_data
      await queryInterface.sequelize.query(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_trigger WHERE tgname = 'update_timeline_data_updated_at'
          ) THEN
            CREATE TRIGGER update_timeline_data_updated_at
              BEFORE UPDATE ON timeline_data
              FOR EACH ROW
              EXECUTE FUNCTION update_updated_at_column();
          END IF;
        END $$;
      `, { transaction });

      await transaction.commit();
      console.log('✅ Migration complete: platform fields, scene columns, timeline_data table');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, _Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable('timeline_data', { transaction });
      await queryInterface.removeColumn('scenes', 'dialogue_clips', { transaction });
      await queryInterface.removeColumn('scenes', 'ui_elements', { transaction });
      await queryInterface.removeColumn('episodes', 'aspect_ratio', { transaction });
      await queryInterface.removeColumn('episodes', 'height', { transaction });
      await queryInterface.removeColumn('episodes', 'width', { transaction });
      await queryInterface.removeColumn('episodes', 'platform', { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};

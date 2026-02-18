'use strict';

/**
 * Migration: Fix missing scene columns and create timeline_data table.
 * 
 * Previous migrations (scene-composer-phase1, add-platform-and-timeline-data,
 * add-scene-background-url) were marked as run in SequelizeMeta by the bootstrap
 * script, but their column additions never actually executed on the dev RDS
 * (the DB was created by sequelize.sync() with a subset of columns).
 * 
 * This migration idempotently adds all missing columns and creates timeline_data.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Helper: check if column exists
      const columnExists = async (table, column) => {
        const [results] = await queryInterface.sequelize.query(
          `SELECT COUNT(*) as count FROM information_schema.columns 
           WHERE table_name = '${table}' AND column_name = '${column}'`,
          { transaction }
        );
        return parseInt(results[0].count) > 0;
      };

      // Helper: check if table exists
      const tableExists = async (table) => {
        const [results] = await queryInterface.sequelize.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = '${table}'
          ) as exists`,
          { transaction }
        );
        return results[0].exists;
      };

      // ── 1. Add missing columns to scenes table ──
      console.log('Checking scenes table for missing columns...');

      if (!(await columnExists('scenes', 'duration_auto'))) {
        console.log('  Adding duration_auto...');
        await queryInterface.addColumn('scenes', 'duration_auto', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          comment: 'If true, duration is auto-calculated from longest clip'
        }, { transaction });
      }

      if (!(await columnExists('scenes', 'layout'))) {
        console.log('  Adding layout...');
        await queryInterface.addColumn('scenes', 'layout', {
          type: Sequelize.JSONB,
          allowNull: true,
          comment: 'JSONB: Spatial layout data for composition'
        }, { transaction });
      }

      if (!(await columnExists('scenes', 'background_url'))) {
        console.log('  Adding background_url...');
        await queryInterface.addColumn('scenes', 'background_url', {
          type: Sequelize.STRING(1000),
          allowNull: true,
          comment: 'URL or S3 key for scene background image'
        }, { transaction });
      }

      if (!(await columnExists('scenes', 'ui_elements'))) {
        console.log('  Adding ui_elements...');
        await queryInterface.addColumn('scenes', 'ui_elements', {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: []
        }, { transaction });
      }

      if (!(await columnExists('scenes', 'dialogue_clips'))) {
        console.log('  Adding dialogue_clips...');
        await queryInterface.addColumn('scenes', 'dialogue_clips', {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: []
        }, { transaction });
      }

      if (!(await columnExists('scenes', 'raw_footage_s3_key'))) {
        console.log('  Adding raw_footage_s3_key...');
        await queryInterface.addColumn('scenes', 'raw_footage_s3_key', {
          type: Sequelize.STRING(500),
          allowNull: true,
          comment: 'S3 key for raw footage file'
        }, { transaction });
      }

      if (!(await columnExists('scenes', 'ai_scene_detected'))) {
        console.log('  Adding ai_scene_detected...');
        await queryInterface.addColumn('scenes', 'ai_scene_detected', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          comment: 'Whether this scene was detected by AI'
        }, { transaction });
      }

      if (!(await columnExists('scenes', 'ai_confidence_score'))) {
        console.log('  Adding ai_confidence_score...');
        await queryInterface.addColumn('scenes', 'ai_confidence_score', {
          type: Sequelize.FLOAT,
          allowNull: true,
          comment: 'AI detection confidence score'
        }, { transaction });
      }

      // ── 2. Add missing platform columns to episodes ──
      console.log('Checking episodes table for missing columns...');

      if (!(await columnExists('episodes', 'platform'))) {
        console.log('  Adding platform...');
        await queryInterface.addColumn('episodes', 'platform', {
          type: Sequelize.STRING(20),
          allowNull: true,
          defaultValue: 'youtube'
        }, { transaction });
      }

      if (!(await columnExists('episodes', 'width'))) {
        console.log('  Adding width...');
        await queryInterface.addColumn('episodes', 'width', {
          type: Sequelize.INTEGER,
          allowNull: true,
          defaultValue: 1920
        }, { transaction });
      }

      if (!(await columnExists('episodes', 'height'))) {
        console.log('  Adding height...');
        await queryInterface.addColumn('episodes', 'height', {
          type: Sequelize.INTEGER,
          allowNull: true,
          defaultValue: 1080
        }, { transaction });
      }

      if (!(await columnExists('episodes', 'aspect_ratio'))) {
        console.log('  Adding aspect_ratio...');
        await queryInterface.addColumn('episodes', 'aspect_ratio', {
          type: Sequelize.STRING(10),
          allowNull: true,
          defaultValue: '16:9'
        }, { transaction });
      }

      // Platform index
      await queryInterface.sequelize.query(
        'CREATE INDEX IF NOT EXISTS idx_episodes_platform ON episodes(platform)',
        { transaction }
      );

      // ── 3. Create timeline_data table if it doesn't exist ──
      if (!(await tableExists('timeline_data'))) {
        console.log('Creating timeline_data table...');
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
          keyframes: {
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

        // Auto-update trigger
        await queryInterface.sequelize.query(`
          CREATE OR REPLACE FUNCTION update_updated_at_column()
          RETURNS TRIGGER AS $$
          BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;
        `, { transaction });

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

        console.log('  timeline_data table created');
      }

      await transaction.commit();
      console.log('✅ Schema fix migration complete');
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error.message);
      throw error;
    }
  },

  async down(queryInterface, _Sequelize) {
    // This is a fixup migration — down would remove columns that should exist
    // Only drop what we exclusively own: the safety net additions
    console.log('Down migration: no-op (fixup migration)');
  }
};

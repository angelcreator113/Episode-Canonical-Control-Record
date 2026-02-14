/**
 * Standalone Migration Runner - Episode Assets & Timeline Placements
 * Run with: node run-timeline-migrations.js
 */

const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: console.log,
  }
);

async function runMigrations() {
  try {
    console.log('🔄 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Connected');

    const queryInterface = sequelize.getQueryInterface();
    const DataTypes = Sequelize.DataTypes;

    // Migration 1: episode_assets
    console.log('\n📦 Creating episode_assets table...');
    
    const episodeAssetsExists = await queryInterface.showAllTables().then(tables => 
      tables.includes('episode_assets')
    );

    if (!episodeAssetsExists) {
      await queryInterface.createTable('episode_assets', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        episode_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'episodes',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
          comment: 'Episode this asset is available in',
        },
        asset_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'assets',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
          comment: 'Show-level asset reference',
        },
        folder: {
          type: DataTypes.STRING(100),
          allowNull: true,
          comment: 'Organization folder (Promo, Overlays, Lower Thirds, etc.)',
        },
        sort_order: {
          type: DataTypes.INTEGER,
          allowNull: true,
          defaultValue: 0,
          comment: 'Display order within episode library',
        },
        tags: {
          type: DataTypes.ARRAY(DataTypes.STRING),
          allowNull: true,
          defaultValue: [],
          comment: 'Episode-specific tags for filtering',
        },
        added_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        added_by: {
          type: DataTypes.STRING(100),
          allowNull: true,
          comment: 'User who added this asset to episode',
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      });

      await queryInterface.addIndex('episode_assets', ['episode_id'], {
        name: 'idx_episode_assets_episode_id',
      });

      await queryInterface.addIndex('episode_assets', ['asset_id'], {
        name: 'idx_episode_assets_asset_id',
      });

      await queryInterface.addIndex('episode_assets', ['episode_id', 'folder'], {
        name: 'idx_episode_assets_episode_folder',
      });

      await queryInterface.addIndex('episode_assets', ['episode_id', 'asset_id'], {
        unique: true,
        name: 'unique_episode_asset',
      });

      console.log('✅ episode_assets table created');
    } else {
      console.log('⏭️  episode_assets table already exists');
    }

    // Migration 2: timeline_placements
    console.log('\n📦 Creating timeline_placements table...');
    
    const timelinePlacementsExists = await queryInterface.showAllTables().then(tables =>
      tables.includes('timeline_placements')
    );

    if (!timelinePlacementsExists) {
      // Create ENUM type first
      await sequelize.query(`
        DO $$ BEGIN
          CREATE TYPE placement_type_enum AS ENUM ('asset', 'wardrobe', 'audio');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);

      await sequelize.query(`
        DO $$ BEGIN
          CREATE TYPE attachment_point_enum AS ENUM ('scene-start', 'scene-end', 'scene-middle', 'custom');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);

      await queryInterface.createTable('timeline_placements', {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        episode_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'episodes',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
          comment: 'Episode this placement belongs to',
        },
        placement_type: {
          type: 'placement_type_enum',
          allowNull: false,
          comment: 'Type of item being placed',
        },
        asset_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'assets',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
          comment: 'Asset reference (for asset placements)',
        },
        wardrobe_item_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'wardrobe',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
          comment: 'Wardrobe reference (for wardrobe placements)',
        },
        scene_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'episode_scenes',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
          comment: 'Scene this placement is attached to (null for time-based)',
        },
        attachment_point: {
          type: 'attachment_point_enum',
          allowNull: true,
          defaultValue: 'scene-start',
          comment: 'Where in the scene this attaches',
        },
        offset_seconds: {
          type: DataTypes.DECIMAL(10, 3),
          allowNull: true,
          defaultValue: 0,
          comment: 'Offset from attachment point (seconds)',
        },
        absolute_timestamp: {
          type: DataTypes.DECIMAL(10, 3),
          allowNull: true,
          comment: 'Absolute time in episode (for time-based placements)',
        },
        track_number: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 2,
          comment: 'Timeline track (1=scenes, 2=assets, 3=audio)',
        },
        duration: {
          type: DataTypes.DECIMAL(10, 3),
          allowNull: true,
          comment: 'Display duration (seconds, null for wardrobe events)',
        },
        z_index: {
          type: DataTypes.INTEGER,
          allowNull: true,
          defaultValue: 10,
          comment: 'Layering order within track',
        },
        properties: {
          type: DataTypes.JSONB,
          allowNull: true,
          defaultValue: {},
          comment: 'Custom properties (opacity, position, effects, etc.)',
        },
        character: {
          type: DataTypes.STRING(100),
          allowNull: true,
          comment: 'Character name (for wardrobe placements)',
        },
        label: {
          type: DataTypes.STRING(255),
          allowNull: true,
          comment: 'User-friendly label for this placement',
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      });

      await queryInterface.addIndex('timeline_placements', ['episode_id'], {
        name: 'idx_timeline_placements_episode_id',
      });

      await queryInterface.addIndex('timeline_placements', ['scene_id'], {
        name: 'idx_timeline_placements_scene_id',
      });

      await queryInterface.addIndex('timeline_placements', ['episode_id', 'track_number'], {
        name: 'idx_timeline_placements_episode_track',
      });

      console.log('✅ timeline_placements table created');
    } else {
      console.log('⏭️  timeline_placements table already exists');
    }

    console.log('\n✅ All migrations completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

runMigrations();

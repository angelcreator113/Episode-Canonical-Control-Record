'use strict';

/**
 * Database Configuration and Model Initialization
 *
 * This file:
 * 1. Loads database configuration from config/sequelize.js
 * 2. Initializes all Sequelize models
 * 3. Sets up model associations
 * 4. Exports models and helper functions
 */

const { Sequelize } = require('sequelize');
// const _path = require('path'); // Removed: unused import
require('dotenv').config();

// Load database configuration
const config = require('../config/sequelize');
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

if (!dbConfig) {
  throw new Error(`Database configuration not found for environment: ${env}`);
}

/**
 * Initialize Sequelize with environment-specific config
 */
const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
  host: dbConfig.host,
  port: dbConfig.port,
  dialect: dbConfig.dialect,
  logging: dbConfig.logging,
  pool: dbConfig.pool,
  dialectOptions: dbConfig.dialectOptions,
  define: dbConfig.define,
  retry: dbConfig.retry,
});

/**
 * Import Models
 * Each model is a function that takes sequelize instance
 */
let Episode, MetadataStorage, Thumbnail, ProcessingQueue, ActivityLog;
let FileStorage, Asset, ThumbnailComposition, ThumbnailTemplate, EpisodeTemplate;
let Show, Scene, AssetLabel, AssetUsage;
let Wardrobe, EpisodeWardrobe, OutfitSet;

try {
  // Core models
  Episode = require('./Episode')(sequelize);
  MetadataStorage = require('./MetadataStorage')(sequelize);
  Thumbnail = require('./Thumbnail')(sequelize);
  ProcessingQueue = require('./ProcessingQueue')(sequelize);
  ActivityLog = require('./ActivityLog')(sequelize);

  // Phase 2 models
  FileStorage = require('./FileStorage')(sequelize);
  Asset = require('./Asset')(sequelize);

  // Phase 2.5 models
  ThumbnailComposition = require('./ThumbnailComposition')(sequelize);
  ThumbnailTemplate = require('./ThumbnailTemplate')(sequelize);
  EpisodeTemplate = require('./EpisodeTemplate')(sequelize);

  // Phase 6 models
  Show = require('./Show')(sequelize);
  Scene = require('./Scene')(sequelize);

  // Asset enhancement models
  AssetLabel = require('./AssetLabel')(sequelize);
  AssetUsage = require('./AssetUsage')(sequelize);

  // Wardrobe models
  Wardrobe = require('./Wardrobe')(sequelize);
  EpisodeWardrobe = require('./EpisodeWardrobe')(sequelize);
  
  // Outfit sets model
  OutfitSet = require('./OutfitSet')(sequelize);

  console.log('✅ All models loaded successfully');
} catch (error) {
  console.error('❌ Error loading models:', error.message);
  throw error;
}

/**
 * Validate Required Models
 */
const requiredModels = {
  Episode,
  MetadataStorage,
  Thumbnail,
  ProcessingQueue,
  ActivityLog,
  FileStorage,
  Asset,
  ThumbnailComposition,
  ThumbnailTemplate,
  EpisodeTemplate,
  Show,
  Scene,
  AssetLabel,
  AssetUsage,
  Wardrobe,
  EpisodeWardrobe,
  OutfitSet,
};

Object.entries(requiredModels).forEach(([name, model]) => {
  if (!model) {
    throw new Error(`Required model not loaded: ${name}`);
  }
});

/**
 * Define Model Associations
 * Order matters: define associations after all models are loaded
 */

// ==================== EPISODE ASSOCIATIONS ====================

// Episode → MetadataStorage (1:N)
Episode.hasMany(MetadataStorage, {
  foreignKey: 'episode_id',
  as: 'metadata',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

MetadataStorage.belongsTo(Episode, {
  foreignKey: 'episode_id',
  as: 'episode',
});

// Episode → Thumbnail (1:N)
Episode.hasMany(Thumbnail, {
  foreignKey: 'episode_id',
  as: 'thumbnails',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

Thumbnail.belongsTo(Episode, {
  foreignKey: 'episode_id',
  as: 'episode',
});

// Episode → ProcessingQueue (1:N)
Episode.hasMany(ProcessingQueue, {
  foreignKey: 'episode_id',
  as: 'processingJobs',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

ProcessingQueue.belongsTo(Episode, {
  foreignKey: 'episode_id',
  as: 'episode',
});

// Episode → FileStorage (1:N)
Episode.hasMany(FileStorage, {
  foreignKey: 'episode_id',
  as: 'files',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

FileStorage.belongsTo(Episode, {
  foreignKey: 'episode_id',
  as: 'episode',
});

// Episode → ThumbnailComposition (1:N)
Episode.hasMany(ThumbnailComposition, {
  foreignKey: 'episode_id',
  as: 'compositions',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

ThumbnailComposition.belongsTo(Episode, {
  foreignKey: 'episode_id',
  as: 'episode',
});

// Episode → Scene (1:N)
Episode.hasMany(Scene, {
  foreignKey: 'episode_id',
  as: 'scenes',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

Scene.belongsTo(Episode, {
  foreignKey: 'episode_id',
  as: 'episode',
});

// Scene → Thumbnail (N:1)
Scene.belongsTo(Thumbnail, {
  foreignKey: 'thumbnail_id',
  as: 'thumbnail',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});

Thumbnail.hasMany(Scene, {
  foreignKey: 'thumbnail_id',
  as: 'scenes',
});

// ==================== PROCESSING QUEUE ASSOCIATIONS ====================

// ProcessingQueue → FileStorage (1:1)
ProcessingQueue.hasOne(FileStorage, {
  foreignKey: 'processing_job_id',
  as: 'file',
});

FileStorage.belongsTo(ProcessingQueue, {
  foreignKey: 'processing_job_id',
  as: 'processingJob',
});

// ==================== THUMBNAIL COMPOSITION ASSOCIATIONS ====================

// ThumbnailComposition → ThumbnailTemplate
ThumbnailComposition.belongsTo(ThumbnailTemplate, {
  foreignKey: 'template_id',
  as: 'template',
});

ThumbnailTemplate.hasMany(ThumbnailComposition, {
  foreignKey: 'template_id',
  as: 'compositions',
});

// ThumbnailComposition → Assets (multiple relationships)
ThumbnailComposition.belongsTo(Asset, {
  foreignKey: 'lala_asset_id',
  as: 'lalaAsset',
});

ThumbnailComposition.belongsTo(Asset, {
  foreignKey: 'guest_asset_id',
  as: 'guestAsset',
});

ThumbnailComposition.belongsTo(Asset, {
  foreignKey: 'justawomen_asset_id',
  as: 'justawomanAsset',
});

ThumbnailComposition.belongsTo(Asset, {
  foreignKey: 'background_frame_asset_id',
  as: 'backgroundAsset',
});

// Reverse associations for Assets
Asset.hasMany(ThumbnailComposition, {
  foreignKey: 'lala_asset_id',
  as: 'lalaCompositions',
});

Asset.hasMany(ThumbnailComposition, {
  foreignKey: 'guest_asset_id',
  as: 'guestCompositions',
});

Asset.hasMany(ThumbnailComposition, {
  foreignKey: 'justawomen_asset_id',
  as: 'justawomanCompositions',
});

Asset.hasMany(ThumbnailComposition, {
  foreignKey: 'background_frame_asset_id',
  as: 'backgroundCompositions',
});

// ==================== ASSET LABEL ASSOCIATIONS ====================

// TEMPORARILY DISABLED: asset_labels table doesn't exist yet
// TODO: Create asset_labels and asset_label_mappings tables, then re-enable
/*
// Asset ←→ AssetLabel (Many-to-Many)
Asset.belongsToMany(AssetLabel, {
  through: 'asset_label_mappings',
  foreignKey: 'asset_id',
  otherKey: 'label_id',
  as: 'labels',
});

AssetLabel.belongsToMany(Asset, {
  through: 'asset_label_mappings',
  foreignKey: 'label_id',
  otherKey: 'asset_id',
  as: 'assets',
});
*/

// Asset → AssetUsage (1:N)
Asset.hasMany(AssetUsage, {
  foreignKey: 'asset_id',
  as: 'usages',
  onDelete: 'CASCADE',
});

AssetUsage.belongsTo(Asset, {
  foreignKey: 'asset_id',
  as: 'asset',
});

// ==================== WARDROBE ASSOCIATIONS ====================

// Episode ←→ Wardrobe (Many-to-Many through EpisodeWardrobe)
Episode.belongsToMany(Wardrobe, {
  through: EpisodeWardrobe,
  foreignKey: 'episode_id',
  otherKey: 'wardrobe_id',
  as: 'wardrobeItems',
});

Wardrobe.belongsToMany(Episode, {
  through: EpisodeWardrobe,
  foreignKey: 'wardrobe_id',
  otherKey: 'episode_id',
  as: 'episodes',
});

// Episode → EpisodeWardrobe (1:N)
Episode.hasMany(EpisodeWardrobe, {
  foreignKey: 'episode_id',
  as: 'wardrobeLinks',
});

EpisodeWardrobe.belongsTo(Episode, {
  foreignKey: 'episode_id',
  as: 'episode',
});

// Wardrobe → EpisodeWardrobe (1:N)
Wardrobe.hasMany(EpisodeWardrobe, {
  foreignKey: 'wardrobe_id',
  as: 'episodeLinks',
});

EpisodeWardrobe.belongsTo(Wardrobe, {
  foreignKey: 'wardrobe_id',
  as: 'wardrobeItem',
});

console.log('✅ Model associations defined');

/**
 * Database Helper Functions
 */
const db = {
  // Sequelize instance and class
  sequelize,
  Sequelize,

  // All models
  models: {
    Episode,
    MetadataStorage,
    Thumbnail,
    ProcessingQueue,
    ActivityLog,
    FileStorage,
    Asset,
    ThumbnailComposition,
    ThumbnailTemplate,
    EpisodeTemplate,
    Scene,
    AssetLabel,
    AssetUsage,
    Wardrobe,
    EpisodeWardrobe,
  },

  /**
   * Test database connection
   */
  authenticate: async () => {
    try {
      await sequelize.authenticate();
      console.log('✅ Database connection authenticated');
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);

      // Provide helpful error messages
      if (error.message.includes('ECONNREFUSED')) {
        console.error('💡 Is PostgreSQL running?');
        console.error(`💡 Check: ${dbConfig.host}:${dbConfig.port}`);
      } else if (error.message.includes('password authentication failed')) {
        console.error('💡 Check database credentials in .env');
      } else if (error.message.includes('database') && error.message.includes('does not exist')) {
        console.error('💡 Create database first:');
        console.error(`   createdb ${dbConfig.database}`);
      }

      throw error;
    }
  },

  /**
   * Sync database schema with models
   * @param {Object} options - Sequelize sync options
   */
  sync: async (options = {}) => {
    try {
      const defaultOptions = {
        alter: process.env.NODE_ENV === 'development',
        force: false,
        logging: dbConfig.logging,
      };

      console.log(`🔄 Syncing database (${env} mode)...`);
      await sequelize.sync({ ...defaultOptions, ...options });
      console.log('✅ Database schema synchronized');
      return true;
    } catch (error) {
      console.error('❌ Database sync failed:', error.message);
      throw error;
    }
  },

  /**
   * Close database connection gracefully
   */
  close: async () => {
    try {
      await sequelize.close();
      console.log('✅ Database connection closed');
      return true;
    } catch (error) {
      console.error('❌ Error closing database:', error.message);
      throw error;
    }
  },

  /**
   * Drop all tables (DANGER! Development only)
   */
  drop: async () => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('🚨 Cannot drop database in production!');
    }

    const confirmed = process.env.CONFIRM_DROP === 'true';
    if (!confirmed) {
      throw new Error('Set CONFIRM_DROP=true to drop database');
    }

    try {
      console.log('⚠️  Dropping all tables...');
      await sequelize.drop();
      console.log('✅ All tables dropped');
      return true;
    } catch (error) {
      console.error('❌ Error dropping tables:', error.message);
      throw error;
    }
  },

  /**
   * Get database statistics
   */
  getStats: async () => {
    try {
      const [
        episodes,
        metadata,
        thumbnails,
        processingJobs,
        activities,
        files,
        assets,
        compositions,
      ] = await Promise.all([
        Episode.count(),
        MetadataStorage.count(),
        Thumbnail.count(),
        ProcessingQueue.count(),
        ActivityLog.count(),
        FileStorage.count(),
        Asset.count(),
        ThumbnailComposition.count(),
      ]);

      return {
        episodes,
        metadata,
        thumbnails,
        processingJobs,
        activities,
        files,
        assets,
        compositions,
        total:
          episodes +
          metadata +
          thumbnails +
          processingJobs +
          activities +
          files +
          assets +
          compositions,
      };
    } catch (error) {
      console.error('❌ Error getting stats:', error.message);
      throw error;
    }
  },

  /**
   * Check database health
   */
  healthCheck: async () => {
    try {
      await sequelize.authenticate();
      const stats = await db.getStats();

      return {
        status: 'healthy',
        database: dbConfig.database,
        host: dbConfig.host,
        port: dbConfig.port,
        environment: env,
        stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  },
};

// Export models individually for convenience
module.exports = db;
module.exports.Episode = Episode;
module.exports.MetadataStorage = MetadataStorage;
module.exports.Thumbnail = Thumbnail;
module.exports.ProcessingQueue = ProcessingQueue;
module.exports.ActivityLog = ActivityLog;
module.exports.FileStorage = FileStorage;
module.exports.Asset = Asset;
module.exports.ThumbnailComposition = ThumbnailComposition;
module.exports.ThumbnailTemplate = ThumbnailTemplate;
module.exports.EpisodeTemplate = EpisodeTemplate;
module.exports.Show = Show;
module.exports.Scene = Scene;
module.exports.Wardrobe = Wardrobe;
module.exports.EpisodeWardrobe = EpisodeWardrobe;
module.exports.OutfitSet = OutfitSet;
module.exports.EpisodeWardrobe = EpisodeWardrobe;
module.exports.AssetLabel = AssetLabel;
module.exports.AssetUsage = AssetUsage;

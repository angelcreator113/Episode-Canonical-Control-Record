'use strict';
const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

/**
 * Database Configuration and Model Initialization
 */

// Initialize Sequelize
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'episode_metadata_dev',
  logging: process.env.SQL_LOGGING === 'true' ? console.log : false,
  pool: {
    max: parseInt(process.env.DB_POOL_MAX || '10'),
    min: parseInt(process.env.DB_POOL_MIN || '2'),
    acquire: 30000,
    idle: 10000,
  },
  define: {
    freezeTableName: false,
    underscored: true,
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
  },
  dialectOptions: {
    supportBigNumbers: true,
    bigNumberStrings: true,
    ssl: {
      require: false,
      rejectUnauthorized: false,
    },
  },
});

// Import models
const Episode = require('./Episode')(sequelize);
const MetadataStorage = require('./MetadataStorage')(sequelize);
const Thumbnail = require('./Thumbnail')(sequelize);
const ProcessingQueue = require('./ProcessingQueue')(sequelize);
const ActivityLog = require('./ActivityLog')(sequelize);
const FileStorage = require('./FileStorage')(sequelize);

/**
 * Define Model Associations
 */

// Episode associations
Episode.hasMany(MetadataStorage, {
  foreignKey: 'episodeId',
  as: 'metadata',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

Episode.hasMany(Thumbnail, {
  foreignKey: 'episodeId',
  as: 'thumbnails',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

Episode.hasMany(ProcessingQueue, {
  foreignKey: 'episodeId',
  as: 'processingJobs',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

// Phase 2: FileStorage associations
Episode.hasMany(FileStorage, {
  foreignKey: 'episode_id',
  as: 'files',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

ProcessingQueue.hasOne(FileStorage, {
  foreignKey: 'processing_job_id',
  as: 'file',
});

// Reverse associations
MetadataStorage.belongsTo(Episode, {
  foreignKey: 'episodeId',
  as: 'episode',
});

Thumbnail.belongsTo(Episode, {
  foreignKey: 'episodeId',
  as: 'episode',
});

ProcessingQueue.belongsTo(Episode, {
  foreignKey: 'episodeId',
  as: 'episode',
});

// Phase 2: FileStorage reverse associations
FileStorage.belongsTo(Episode, {
  foreignKey: 'episode_id',
  as: 'episode',
});

FileStorage.belongsTo(ProcessingQueue, {
  foreignKey: 'processing_job_id',
  as: 'processingJob',
});

/**
 * Database Helper Functions
 */

const db = {
  // Sequelize instance
  sequelize,
  Sequelize,

  // Models
  models: {
    Episode,
    MetadataStorage,
    Thumbnail,
    ProcessingQueue,
    ActivityLog,
    FileStorage,
  },

  /**
   * Sync database schema with models
   * @param {Object} options - Sequelize sync options
   */
  sync: async (options = {}) => {
    try {
      const defaultOptions = {
        alter: process.env.NODE_ENV !== 'production',
        logging: process.env.SQL_LOGGING === 'true' ? console.log : false,
      };

      await sequelize.sync({ ...defaultOptions, ...options });
      console.log('✅ Database schema synchronized');
      return true;
    } catch (error) {
      console.error('❌ Database sync failed:', error);
      throw error;
    }
  },

  /**
   * Authenticate database connection
   */
  authenticate: async () => {
    try {
      await sequelize.authenticate();
      console.log('✅ Database connection authenticated');
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  },

  /**
   * Close database connection
   */
  close: async () => {
    try {
      await sequelize.close();
      console.log('✅ Database connection closed');
      return true;
    } catch (error) {
      console.error('❌ Error closing database:', error);
      throw error;
    }
  },

  /**
   * Drop all tables (danger! dev only)
   */
  drop: async () => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot drop database in production');
    }
    try {
      await sequelize.drop();
      console.log('✅ All tables dropped');
      return true;
    } catch (error) {
      console.error('❌ Error dropping tables:', error);
      throw error;
    }
  },

  /**
   * Get database stats
   */
  getStats: async () => {
    try {
      const episodes = await Episode.count();
      const metadata = await MetadataStorage.count();
      const thumbnails = await Thumbnail.count();
      const processingJobs = await ProcessingQueue.count();
      const activities = await ActivityLog.count();

      return {
        episodes,
        metadata,
        thumbnails,
        processingJobs,
        activities,
      };
    } catch (error) {
      console.error('❌ Error getting stats:', error);
      throw error;
    }
  },
};

module.exports = db;

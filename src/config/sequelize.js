/**
 * Sequelize Database Configuration
 * Environment-specific database connection settings
 * 
 * This file is used by Sequelize CLI for migrations and seeds
 * For application usage, use ./database.js instead
 */

require('dotenv').config();

/**
 * Parse DATABASE_URL if provided (useful for Heroku, Railway, etc.)
 */
function parseDatabaseUrl(url) {
  if (!url) return null;
  
  try {
    // Format: postgres://user:password@host:port/database
    const match = url.match(/postgres:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    
    if (!match) {
      console.warn('⚠️  Invalid DATABASE_URL format');
      return null;
    }
    
    return {
      username: decodeURIComponent(match[1]),
      password: decodeURIComponent(match[2]),
      host: match[3],
      port: parseInt(match[4]),
      database: match[5].split('?')[0], // Remove query params
    };
  } catch (error) {
    console.error('❌ Error parsing DATABASE_URL:', error.message);
    return null;
  }
}

/**
 * Base configuration shared across all environments
 */
const baseConfig = {
  dialect: 'postgres',
  dialectOptions: {
    ssl: process.env.DB_SSL === 'true' ? {
      require: true,
      rejectUnauthorized: false, // For self-signed certificates
    } : false,
    // Connection timeout
    connectTimeout: 60000,
  },
  define: {
    // Use snake_case for database columns
    underscored: true,
    // Add timestamps (created_at, updated_at)
    timestamps: true,
    // Add deleted_at for soft deletes
    paranoid: true,
    // Don't pluralize table names
    freezeTableName: true,
  },
  // Retry failed connections
  retry: {
    max: 3,
    match: [
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/,
    ],
  },
};

/**
 * Development Configuration
 */
const development = {
  ...baseConfig,
  ...(parseDatabaseUrl(process.env.DATABASE_URL) || {
    username: process.env.DB_USER || process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || process.env.DB_DATABASE || 'episode_metadata_dev',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
  }),
  logging: process.env.SQL_LOGGING === 'true' ? console.log : false,
  pool: {
    max: 10,
    min: 2,
    acquire: 30000, // Maximum time (ms) to try to get connection before throwing error
    idle: 10000,    // Maximum time (ms) a connection can be idle before being released
  },
  // Disable SSL in development
  dialectOptions: {
    ...baseConfig.dialectOptions,
    ssl: false,
  },
};

/**
 * Test Configuration
 * Uses separate test database to avoid polluting development data
 */
const test = {
  ...baseConfig,
  ...(parseDatabaseUrl(process.env.TEST_DATABASE_URL) || {
    username: process.env.DB_USER || process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.TEST_DB_NAME || 'episode_metadata_test',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
  }),
  logging: false, // Disable logging in tests
  pool: {
    max: 5,
    min: 1,
    acquire: 30000,
    idle: 10000,
  },
  dialectOptions: {
    ...baseConfig.dialectOptions,
    ssl: false,
  },
};

/**
 * Staging Configuration
 */
const staging = {
  ...baseConfig,
  ...(parseDatabaseUrl(process.env.DATABASE_URL) || {
    username: process.env.DB_USER || process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || process.env.DB_DATABASE,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
  }),
  logging: false,
  pool: {
    max: 20,
    min: 5,
    acquire: 30000,
    idle: 10000,
  },
  dialectOptions: {
    ...baseConfig.dialectOptions,
    ssl: process.env.DB_SSL === 'true' ? {
      require: true,
      rejectUnauthorized: false,
    } : false,
  },
};

/**
 * Production Configuration
 * Includes read replica support and enhanced security
 */
const production = {
  ...baseConfig,
  ...(parseDatabaseUrl(process.env.DATABASE_URL) || {
    username: process.env.DB_USER || process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || process.env.DB_DATABASE,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
  }),
  logging: false,
  pool: {
    max: 30,
    min: 10,
    acquire: 60000, // Longer timeout in production
    idle: 10000,
  },
  dialectOptions: {
    ...baseConfig.dialectOptions,
    ssl: {
      require: true,
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    },
    // Statement timeout (30 seconds)
    statement_timeout: 30000,
  },
};

// Add read replica support if configured
if (process.env.DB_READ_REPLICA_HOST) {
  production.replication = {
    read: [
      {
        host: process.env.DB_READ_REPLICA_HOST,
        username: process.env.DB_USER || process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432'),
      },
    ],
    write: {
      host: process.env.DB_HOST,
      username: process.env.DB_USER || process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      port: parseInt(process.env.DB_PORT || '5432'),
    },
  };
}

/**
 * Export configuration based on NODE_ENV
 */
module.exports = {
  development,
  test,
  staging,
  production,
};

/**
 * Export current environment config as default
 * This is useful when importing directly
 */
const env = process.env.NODE_ENV || 'development';
module.exports.default = module.exports[env];

// Validate configuration on load
if (!module.exports[env]) {
  throw new Error(`Invalid NODE_ENV: ${env}. Must be one of: development, test, staging, production`);
}

// Log configuration (without sensitive data)
if (process.env.DEBUG_CONFIG === 'true') {
  console.log('📋 Database Configuration:');
  console.log(`  Environment: ${env}`);
  console.log(`  Host: ${module.exports[env].host}`);
  console.log(`  Port: ${module.exports[env].port}`);
  console.log(`  Database: ${module.exports[env].database}`);
  console.log(`  SSL: ${!!module.exports[env].dialectOptions?.ssl}`);
  console.log(`  Pool Max: ${module.exports[env].pool.max}`);
}
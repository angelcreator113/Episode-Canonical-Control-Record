/* eslint-disable no-console */
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
    const parsed = new URL(url);

    if (!parsed.hostname || !parsed.username) {
      console.warn('⚠️  Invalid DATABASE_URL format');
      return null;
    }

    return {
      username: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      host: parsed.hostname,
      port: parseInt(parsed.port || '5432'),
      database: parsed.pathname.replace(/^\//, '').split('?')[0],
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
    ssl:
      process.env.DB_SSL === 'true'
        ? {
            require: true,
            rejectUnauthorized: false, // For self-signed certificates
          }
        : false,
    // Connection timeout
    connectTimeout: 60000,
    // Force UTF-8 encoding for emoji support
    client_encoding: 'UTF8',
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
    idle: 10000, // Maximum time (ms) a connection can be idle before being released
  },
  // Enable SSL for AWS RDS in development
  dialectOptions: {
    ...baseConfig.dialectOptions,
    ssl:
      process.env.DB_SSL === 'true'
        ? {
            require: true,
            rejectUnauthorized: false,
          }
        : false,
  },
};

/**
 * Test Configuration
 * Uses separate test database to avoid polluting development data
 * Falls back to DATABASE_URL when TEST_DATABASE_URL is not set (e.g. in CI)
 */
const test = {
  ...baseConfig,
  ...(parseDatabaseUrl(process.env.TEST_DATABASE_URL) || parseDatabaseUrl(process.env.DATABASE_URL) || {
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
 * Production configuration uses discrete DB_* env vars only. DATABASE_URL is intentionally NOT consulted here
 * because our production deployment uses AWS RDS with discrete env vars passed via PM2's ecosystem.config.js.
 * Removing the DATABASE_URL pathway eliminates a class of drift where a stale or incorrect URL in .env
 * could silently override the correct RDS connection.
 * Also includes read-replica support when DB_READ_REPLICA_HOST is configured.
 */
/** The production pool size: DB_POOL_MAX when it is a whole number from 1 to 30, else 30. */
function poolMax(env = process.env) {
  const n = Number(env.DB_POOL_MAX);
  return Number.isInteger(n) && n >= 1 && n <= 30 ? n : 30;
}

/** The production login: the worker's held one when set, else DB_USER / DB_PASSWORD. */
function productionLogin() {
  const held = require('./dbCredentials').getDbCredentials();
  if (held) return { username: held.user, password: held.password };
  return { username: process.env.DB_USER || process.env.DB_USERNAME, password: process.env.DB_PASSWORD };
}

const production = {
  ...baseConfig,
  // The episode worker's login is held in memory (src/config/dbCredentials.js,
  // #3714), never in process.env; read when the models connect. Every other
  // process sets nothing there and keeps DB_USER / DB_PASSWORD.
  get username() { return productionLogin().username; },
  get password() { return productionLogin().password; },
  database: process.env.DB_NAME || process.env.DB_DATABASE,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  logging: false,
  pool: {
    // DB_POOL_MAX is set only for the episode worker (ecosystem.config.js,
    // #3714): its login has CONNECTION LIMIT 5, so its pool stays below that.
    // The API sets no DB_POOL_MAX and keeps 30 / 10.
    max: poolMax(),
    min: Math.min(10, poolMax()),
    acquire: 60000, // Longer timeout in production
    idle: 10000,
  },
  dialectOptions: {
    ...baseConfig.dialectOptions,
    ssl:
      process.env.DB_SSL === 'false'
        ? false
        : {
            require: true,
            rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
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
        get username() { return productionLogin().username; },
        get password() { return productionLogin().password; },
        port: parseInt(process.env.DB_PORT || '5432'),
      },
    ],
    write: {
      host: process.env.DB_HOST,
      get username() { return productionLogin().username; },
      get password() { return productionLogin().password; },
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
  production,
};

/**
 * Export current environment config as default
 * This is useful when importing directly
 */
const env = process.env.NODE_ENV || 'development';
module.exports.default = module.exports[env];
module.exports.poolMax = poolMax;

// Validate configuration on load
if (!module.exports[env]) {
  throw new Error(
    `Invalid NODE_ENV: ${env}. Must be one of: development, test, production`
  );
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

// ============================================================================
// DATABASE CONFIGURATION
// ============================================================================
// Placeholder for database connection logic
// Will be implemented in Phase 1

const { Pool } = require('pg');

let pool = null;

const getPool = () => {
  if (!pool) {
    const sslConfig = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;
    const baseConfig = {
      max: parseInt(process.env.DATABASE_POOL_MAX || 10),
      min: parseInt(process.env.DATABASE_POOL_MIN || 2),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      client_encoding: 'UTF8',
      ssl: sslConfig,
    };

    if (process.env.DATABASE_URL) {
      // Strip sslmode from connection string — we set ssl explicitly
      baseConfig.connectionString = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, '');
    } else {
      baseConfig.host = process.env.DB_HOST || '127.0.0.1';
      baseConfig.port = parseInt(process.env.DB_PORT || '5432', 10);
      baseConfig.database = process.env.DB_NAME || 'episode_metadata';
      baseConfig.user = process.env.DB_USER || 'postgres';
      baseConfig.password = process.env.DB_PASSWORD || '';
    }

    pool = new Pool(baseConfig);

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });

    // Set encoding on every new client connection
    pool.on('connect', (client) => {
      client.query('SET CLIENT_ENCODING TO UTF8;');
    });
  }

  return pool;
};

const closePool = async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};

module.exports = {
  getPool,
  closePool,
};

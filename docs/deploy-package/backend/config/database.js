// ============================================================================
// DATABASE CONFIGURATION
// ============================================================================
// Placeholder for database connection logic
// Will be implemented in Phase 1

const { Pool } = require('pg');

let pool = null;

const getPool = () => {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: parseInt(process.env.DATABASE_POOL_MAX || 10),
      min: parseInt(process.env.DATABASE_POOL_MIN || 2),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
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

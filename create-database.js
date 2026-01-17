/**
 * Create Database Script
 * Creates the episode_metadata database on a PostgreSQL server
 */

const { Client } = require('pg');
const path = require('path');

async function createDatabase() {
  const env = process.env.NODE_ENV || 'production';
  const envFile = env === 'production' ? '.env.production' : `.env.${env}`;
  
  require('dotenv').config({ path: path.join(__dirname, envFile) });

  const dbHost = process.env.DB_HOST;
  const dbUser = process.env.DB_USER;
  const dbPassword = process.env.DB_PASSWORD;
  const dbName = process.env.DB_NAME || 'episode_metadata';

  console.log(`\n🔧 Creating database: ${dbName}`);
  console.log(`📍 Host: ${dbHost}\n`);

  // Connect to postgres database to create the new database
  const client = new Client({
    host: dbHost,
    port: 5432,
    user: dbUser,
    password: dbPassword,
    database: 'postgres', // Connect to default postgres database
    ssl: process.env.DATABASE_SSL === 'true' ? {
      rejectUnauthorized: false
    } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL server');

    // Check if database exists
    const checkResult = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );

    if (checkResult.rows.length > 0) {
      console.log(`ℹ️  Database '${dbName}' already exists`);
    } else {
      // Create database
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`✅ Database '${dbName}' created successfully`);
    }

    await client.end();
    console.log('\n✅ Done!\n');
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

createDatabase();

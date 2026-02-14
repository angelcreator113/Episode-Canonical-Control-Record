require('dotenv').config({ path: '.env.aws-staging' });
const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  try {
    console.log('🔌 Connecting to dev database...');
    console.log('Host:', client.host);
    console.log('User:', client.user);
    console.log('Database:', client.database);
    console.log('Password length:', client.password?.length);
    
    await client.connect();
    console.log('✅ Connected to dev database');

    console.log('📝 Reading migration file...');
    const sql = fs.readFileSync('add-composition-name-column.sql', 'utf8');
    
    console.log('🚀 Running migration...');
    const result = await client.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('Result:', result.rows);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();

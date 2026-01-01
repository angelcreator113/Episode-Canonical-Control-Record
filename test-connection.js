#!/usr/bin/env node

/**
 * Test PostgreSQL Connection
 */

require('dotenv').config();

const { Client } = require('pg');

const config = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionTimeoutMillis: 5000,
};

console.log(`Testing connection to ${config.host}:${config.port}...`);
console.log(`Database: ${config.database}`);
console.log(`User: ${config.user}\n`);

const client = new Client(config);

client.connect()
  .then(() => {
    console.log('✓ Connection successful!');
    
    return client.query('SELECT version()');
  })
  .then(result => {
    console.log('✓ PostgreSQL version:', result.rows[0].version.split(',')[0]);
    
    return client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
  })
  .then(result => {
    console.log('\nExisting tables:', result.rows.length);
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    client.end();
    process.exit(0);
  })
  .catch(error => {
    console.error('✗ Connection failed:', error.message);
    console.error('Details:', error.code);
    process.exit(1);
  });

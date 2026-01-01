#!/usr/bin/env node

/**
 * Database Verification Script
 * Checks connection and verifies all required tables exist
 */

require('dotenv').config();
const { sequelize } = require('../src/models');

const REQUIRED_TABLES = [
  'episodes',
  'metadata_storage',
  'thumbnails',
  'processing_queue',
  'activity_logs'
];

async function verifyDatabase() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║  Database Verification                                         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  try {
    // Test connection
    console.log('Testing database connection...');
    await sequelize.authenticate();
    console.log('✓ Database connection successful\n');

    // Get list of tables using raw SQL query
    console.log('Checking for required tables...');
    const result = await sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
      { type: sequelize.QueryTypes.SELECT }
    );
    // Handle both object format {table_name} and array format [[value]]
    const tables = result.map(row => {
      if (Array.isArray(row)) return row[0];
      return row.table_name;
    });
    
    let allTablesExist = true;
    for (const requiredTable of REQUIRED_TABLES) {
      const exists = tables.includes(requiredTable);
      console.log(`  ${exists ? '✓' : '✗'} ${requiredTable}`);
      if (!exists) allTablesExist = false;
    }

    if (!allTablesExist) {
      console.error('\n❌ Some required tables are missing!');
      process.exit(1);
    }

    // Get table details
    console.log('\n✓ All required tables exist\n');
    console.log('Table details:');
    
    const queryInterface = sequelize.getQueryInterface();
    for (const table of REQUIRED_TABLES) {
      const columns = await queryInterface.describeTable(table);
      const columnCount = Object.keys(columns).length;
      console.log(`  ${table}: ${columnCount} columns`);
    }

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  ✓ Database verification successful!                           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Database verification failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

verifyDatabase();

/**
 * Database Connection Test Script
 * Tests database connectivity for any environment
 * Usage: node db-test-connection.js
 */

const { Sequelize } = require('sequelize');
const path = require('path');

// Load environment-specific config
const env = process.env.NODE_ENV || 'development';
const envFile = env === 'production' ? '.env.production' : `.env.${env}`;

require('dotenv').config({ path: path.join(__dirname, envFile) });

const testConnection = async () => {
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.error('❌ DATABASE_URL not found in environment');
    process.exit(1);
  }

  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║   DATABASE CONNECTION TEST                     ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  // Mask password in URL for display
  const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
  console.log(`ℹ️  Testing connection to: ${maskedUrl}\n`);

  const sequelize = new Sequelize(dbUrl, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: process.env.DATABASE_SSL === 'true' || dbUrl.includes('sslmode=require') ? {
        require: true,
        rejectUnauthorized: false // Accept AWS RDS self-signed certificates
      } : false
    },
    pool: {
      max: 2,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });

  try {
    // Test authentication
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully\n');

    // Get database info
    const [results] = await sequelize.query(`
      SELECT 
        version() as postgres_version,
        current_database() as database_name,
        current_user as current_user,
        pg_database_size(current_database()) as database_size
    `);

    const info = results[0];
    console.log('📊 Database Information:');
    console.log(`   Version: ${info.postgres_version.split(' ')[1]}`);
    console.log(`   Database: ${info.database_name}`);
    console.log(`   User: ${info.current_user}`);
    console.log(`   Size: ${Math.round(info.database_size / 1024 / 1024)} MB\n`);

    // Check tables
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    console.log('📋 Tables:');
    if (tables.length === 0) {
      console.log('   ⚠️  No tables found - run migrations first');
    } else {
      tables.forEach(t => console.log(`   ✓ ${t.table_name}`));
    }
    console.log('');

    // Count records in main tables
    const mainTables = ['episodes', 'shows', 'scenes', 'assets', 'users'];
    const counts = {};

    for (const table of mainTables) {
      try {
        const [result] = await sequelize.query(`SELECT COUNT(*) as count FROM ${table}`);
        counts[table] = result[0].count;
      } catch (error) {
        counts[table] = 'N/A (table not found)';
      }
    }

    console.log('📈 Record Counts:');
    Object.entries(counts).forEach(([table, count]) => {
      console.log(`   ${table}: ${count}`);
    });
    console.log('');

    await sequelize.close();
    console.log('✅ Connection test completed successfully\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    console.error('\n🔍 Troubleshooting:');
    console.error('   1. Verify DATABASE_URL is correct');
    console.error('   2. Check RDS instance is running');
    console.error('   3. Verify security group allows your IP');
    console.error('   4. Confirm database user has correct permissions\n');
    
    await sequelize.close();
    process.exit(1);
  }
};

testConnection();

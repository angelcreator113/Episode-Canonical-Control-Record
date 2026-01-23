/**
 * Local Migration Testing Script
 * Tests migrations against local PostgreSQL database before deployment
 */

const { execSync } = require('child_process');
const { Client } = require('pg');

// Local test database configuration
// Override with environment variables if needed
const TEST_DB_CONFIG = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: process.env.TEST_DB_PORT || 5433, // Using 5433 to avoid conflicts
  user: process.env.TEST_DB_USER || 'postgres',
  password: process.env.TEST_DB_PASSWORD || 'postgres',
  database: process.env.TEST_DB_NAME || 'episode_metadata_test',
};

async function createTestDatabase() {
  const client = new Client({
    host: TEST_DB_CONFIG.host,
    port: TEST_DB_CONFIG.port,
    user: TEST_DB_CONFIG.user,
    password: TEST_DB_CONFIG.password,
    database: 'postgres', // Connect to default database first
  });

  try {
    await client.connect();
    
    // Drop existing test database
    console.log('🗑️  Dropping existing test database...');
    await client.query(`DROP DATABASE IF EXISTS ${TEST_DB_CONFIG.database}`);
    
    // Create fresh test database
    console.log('✨ Creating fresh test database...');
    await client.query(`CREATE DATABASE ${TEST_DB_CONFIG.database}`);
    
    console.log('✅ Test database ready\n');
  } catch (error) {
    console.error('❌ Database setup error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

async function runMigrations() {
  console.log('🚀 Running migrations...\n');
  
  const databaseUrl = `postgresql://${TEST_DB_CONFIG.user}:${TEST_DB_CONFIG.password}@${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port}/${TEST_DB_CONFIG.database}`;
  
  try {
    // Run migrations
    const output = execSync(`npm run migrate:up`, {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    
    console.log(output);
    console.log('\n✅ All migrations passed!\n');
    return true;
  } catch (error) {
    console.error('❌ Migration failed:\n');
    console.error(error.stdout || error.message);
    return false;
  }
}

async function verifyTables() {
  console.log('🔍 Verifying created tables...\n');
  
  const client = new Client(TEST_DB_CONFIG);
  
  try {
    await client.connect();
    
    // Check for key tables
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log('📋 Tables created:');
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });
    
    console.log(`\n   Total: ${result.rows.length} tables\n`);
    
    return result.rows.length > 0;
  } catch (error) {
    console.error('❌ Verification error:', error.message);
    return false;
  } finally {
    await client.end();
  }
}

async function testMigrations() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║         MIGRATION TESTING SUITE                        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  try {
    // Step 1: Create test database
    await createTestDatabase();
    
    // Step 2: Run migrations
    const migrationsSuccess = await runMigrations();
    
    if (!migrationsSuccess) {
      console.error('❌ MIGRATIONS FAILED - Fix errors before deploying\n');
      process.exit(1);
    }
    
    // Step 3: Verify tables
    const verificationSuccess = await verifyTables();
    
    if (!verificationSuccess) {
      console.error('❌ VERIFICATION FAILED - No tables created\n');
      process.exit(1);
    }
    
    // Success!
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ ALL MIGRATION TESTS PASSED');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('✓ Database created successfully');
    console.log('✓ All migrations executed without errors');
    console.log('✓ Tables verified and present');
    console.log('\n🚀 Safe to deploy to dev!\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  testMigrations();
}

module.exports = { testMigrations };

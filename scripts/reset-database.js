require('dotenv').config();
const db = require('../src/models');

async function resetDatabase() {
  try {
    console.log('⚠️  WARNING: This will delete ALL data!');
    console.log('🗄️  Database:', process.env.DB_DATABASE);
    console.log('');

    // Check confirmation
    if (process.env.CONFIRM_DROP !== 'true') {
      console.error('❌ Set CONFIRM_DROP=true to confirm database reset');
      process.exit(1);
    }

    // Authenticate
    console.log('🔍 Connecting to database...');
    await db.authenticate();
    console.log('✅ Connected\n');

    // Drop all tables
    console.log('🗑️  Dropping all tables...');
    await db.drop();
    console.log('✅ All tables dropped\n');

    // Recreate tables
    console.log('🏗️  Creating tables from models...');
    await db.sync();
    console.log('✅ All tables created\n');

    // Get stats
    const stats = await db.getStats();
    console.log('📊 Database Stats:');
    console.log('   Episodes:', stats.episodes);
    console.log('   Assets:', stats.assets);
    console.log('   Templates:', stats.compositions);
    console.log('');

    console.log('✅ Database reset complete!');
    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Reset failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

resetDatabase();
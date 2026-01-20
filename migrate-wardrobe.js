const { sequelize } = require('./src/models');
const fs = require('fs');
const path = require('path');

/**
 * Run the wardrobe tables migration
 * Creates wardrobe and episode_wardrobe tables
 */
async function runMigration() {
  console.log('🚀 Starting wardrobe tables migration...\n');

  try {
    // Test database connection
    console.log('📡 Testing database connection...');
    await sequelize.authenticate();
    console.log('✅ Database connection successful\n');

    // Read the migration SQL file
    const sqlFile = path.join(__dirname, 'migrations', 'create-wardrobe-tables.sql');
    console.log(`📄 Reading SQL file: ${sqlFile}`);
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Execute the migration
    console.log('⚙️  Executing migration SQL...');
    await sequelize.query(sql);
    console.log('✅ Migration executed successfully!\n');

    // Verify tables were created
    console.log('🔍 Verifying tables...');
    const [tables] = await sequelize.query(`
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
        AND table_name IN ('wardrobe', 'episode_wardrobe')
      ORDER BY table_name;
    `);

    if (tables.length === 2) {
      console.log('✅ Tables created successfully:');
      tables.forEach(table => {
        console.log(`   - ${table.table_name} (${table.column_count} columns)`);
      });
    } else {
      console.warn('⚠️  Warning: Expected 2 tables, found', tables.length);
    }

    // Verify indexes
    console.log('\n🔍 Checking indexes...');
    const [indexes] = await sequelize.query(`
      SELECT 
        tablename,
        COUNT(*) as index_count
      FROM pg_indexes
      WHERE tablename IN ('wardrobe', 'episode_wardrobe')
      GROUP BY tablename
      ORDER BY tablename;
    `);

    console.log('✅ Indexes created:');
    indexes.forEach(idx => {
      console.log(`   - ${idx.tablename}: ${idx.index_count} indexes`);
    });

    console.log('\n✨ Migration completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Restart your backend server');
    console.log('   2. Test wardrobe endpoints: GET /api/v1/wardrobe');
    console.log('   3. Create a test wardrobe item: POST /api/v1/wardrobe');
    console.log('   4. Link wardrobe to episode: POST /api/v1/episodes/:id/wardrobe/:wardrobeId');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('\n👋 Database connection closed');
  }
}

// Run the migration
if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = runMigration;

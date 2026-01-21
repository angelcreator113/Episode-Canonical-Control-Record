const { Sequelize } = require('sequelize');
const fs = require('fs');

// Database connection for dev environment
const sequelize = new Sequelize('episode_metadata', 'postgres', 'Ayanna123!!', {
  host: 'episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com',
  dialect: 'postgres',
  port: 5432,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: console.log
});

async function createTables() {
  try {
    // Test connection
    await sequelize.authenticate();
    console.log('✓ Database connection established\n');

    // Read and execute episode_assets SQL
    console.log('Creating episode_assets table...');
    const episodeAssetsSql = fs.readFileSync('create-episode-assets.sql', 'utf8');
    try {
      await sequelize.query(episodeAssetsSql);
      console.log('✓ episode_assets table created successfully\n');
    } catch (error) {
      console.error('❌ Error creating episode_assets:', error.message);
      console.error('Details:', error.original?.message || error);
      console.error('');
    }

    // Read and execute wardrobe tables SQL
    console.log('Creating wardrobe tables...');
    const wardrobeSql = fs.readFileSync('create-wardrobe-tables.sql', 'utf8');
    try {
      await sequelize.query(wardrobeSql);
      console.log('✓ wardrobe tables created successfully\n');
    } catch (error) {
      console.error('❌ Error creating wardrobe tables:', error.message);
      console.error('Details:', error.original?.message || error);
      console.error('');
    }

    // Verify tables were created
    console.log('Verifying tables...');
    const [tables] = await sequelize.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema='public' 
      AND table_name IN ('episode_assets', 'episode_wardrobe', 'wardrobe') 
      ORDER BY table_name
    `);
    
    console.log('\nTables found:');
    tables.forEach(t => console.log(`  ✓ ${t.table_name}`));

    if (tables.length === 3) {
      console.log('\n✅ ALL TABLES CREATED SUCCESSFULLY!');
    } else {
      console.log(`\n⚠️ Only ${tables.length}/3 tables created`);
    }

  } catch (error) {
    console.error('Fatal error:', error.message);
  } finally {
    await sequelize.close();
  }
}

createTables();

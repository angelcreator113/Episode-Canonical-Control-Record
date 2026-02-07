const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
});

async function addColumns() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Connected!');

    console.log('\nAdding ai_analysis_enabled column...');
    await sequelize.query(`
      ALTER TABLE episode_scripts 
      ADD COLUMN IF NOT EXISTS ai_analysis_enabled BOOLEAN NOT NULL DEFAULT false
    `);
    console.log('✅ ai_analysis_enabled column added');

    console.log('\nAdding last_analyzed_at column...');
    await sequelize.query(`
      ALTER TABLE episode_scripts 
      ADD COLUMN IF NOT EXISTS last_analyzed_at TIMESTAMP
    `);
    console.log('✅ last_analyzed_at column added');

    console.log('\nCreating index...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS episode_scripts_ai_analysis_enabled_idx 
      ON episode_scripts(ai_analysis_enabled)
    `);
    console.log('✅ Index created');

    console.log('\nVerifying columns...');
    const [results] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'episode_scripts' 
      AND column_name IN ('ai_analysis_enabled', 'last_analyzed_at')
    `);
    
    console.log('\n✅ Columns verified:');
    console.table(results);

    console.log('\n🎉 All done! The AI toggle should work now!');
    console.log('Refresh your browser page.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

addColumns();

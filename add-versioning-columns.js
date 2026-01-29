require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: console.log
});

async function addVersioningColumns() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection authenticated');

    // Add versioning columns
    await sequelize.query(`
      ALTER TABLE thumbnail_compositions 
      ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS version_history JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS last_modified_by VARCHAR(100),
      ADD COLUMN IF NOT EXISTS modification_timestamp TIMESTAMP DEFAULT NOW();
    `);
    
    console.log('✅ Added versioning columns');

    // Verify columns
    const [columns] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'thumbnail_compositions' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\nCurrent columns:', columns.map(c => c.column_name).join(', '));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

addVersioningColumns();

// Remove foreign key constraint to allow template_studio references
const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'episode_metadata',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '1234',
  dialect: 'postgres',
  logging: console.log
});

async function removeConstraint() {
  try {
    console.log('🔌 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Connected');
    
    console.log('🔧 Dropping foreign key constraint...');
    await sequelize.query(`
      ALTER TABLE thumbnail_compositions 
      DROP CONSTRAINT IF EXISTS thumbnail_compositions_template_id_fkey;
    `);
    console.log('✅ Foreign key constraint removed');
    
    console.log('📝 Adding comment...');
    await sequelize.query(`
      COMMENT ON COLUMN thumbnail_compositions.template_id IS 
      'UUID referencing either thumbnail_templates (legacy) or template_studio (new system)';
    `);
    console.log('✅ Comment added');
    
    await sequelize.close();
    console.log('✅ Done!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

removeConstraint();

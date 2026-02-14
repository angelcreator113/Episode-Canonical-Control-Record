/**
 * Add missing columns to assets table
 * Adds: s3_key_raw, file_name, content_type
 */

require('dotenv').config();
const { Sequelize, QueryTypes } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: console.log,
});

async function addMissingColumns() {
  try {
    console.log('🔌 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Connected\n');

    // Check which columns exist
    const existingColumns = await sequelize.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'assets' AND column_name IN ('s3_key_raw', 'file_name', 'content_type')`,
      { type: QueryTypes.SELECT }
    );

    const exists = existingColumns.map(c => c.column_name);
    console.log('Existing columns:', exists);

    // Add s3_key_raw if missing
    if (!exists.includes('s3_key_raw')) {
      console.log('\n📝 Adding s3_key_raw column...');
      await sequelize.query(`
        ALTER TABLE assets 
        ADD COLUMN s3_key_raw TEXT;
      `);
      console.log('✅ Added s3_key_raw');
    } else {
      console.log('✅ s3_key_raw already exists');
    }

    // Add file_name if missing
    if (!exists.includes('file_name')) {
      console.log('\n📝 Adding file_name column...');
      await sequelize.query(`
        ALTER TABLE assets 
        ADD COLUMN file_name VARCHAR(500);
      `);
      console.log('✅ Added file_name');
    } else {
      console.log('✅ file_name already exists');
    }

    // Add content_type if missing
    if (!exists.includes('content_type')) {
      console.log('\n📝 Adding content_type column...');
      await sequelize.query(`
        ALTER TABLE assets 
        ADD COLUMN content_type VARCHAR(100);
      `);
      console.log('✅ Added content_type');
    } else {
      console.log('✅ content_type already exists');
    }

    // Update existing records to populate s3_key_raw from s3_url_raw
    console.log('\n🔄 Updating existing records...');
    const result = await sequelize.query(`
      UPDATE assets 
      SET s3_key_raw = SUBSTRING(s3_url_raw FROM 'amazonaws\.com/(.*)$')
      WHERE s3_key_raw IS NULL 
        AND s3_url_raw IS NOT NULL 
        AND s3_url_raw LIKE '%amazonaws.com/%'
    `);
    console.log(`✅ Updated ${result[1]} existing records\n`);

    console.log('🎉 Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

addMissingColumns();

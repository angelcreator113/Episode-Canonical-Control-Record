const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: console.log
});

async function addSelectedFormatsColumn() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database\n');

    // Add selected_formats column
    await sequelize.query(`
      ALTER TABLE thumbnail_compositions 
      ADD COLUMN IF NOT EXISTS selected_formats JSONB DEFAULT '[]'::jsonb;
    `);

    console.log('✅ Added selected_formats column\n');

    // Verify
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'thumbnail_compositions' 
      ORDER BY ordinal_position;
    `);

    console.log('Current columns in thumbnail_compositions:');
    columns.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

addSelectedFormatsColumn();

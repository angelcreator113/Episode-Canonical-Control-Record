require('dotenv').config();
const db = require('./src/models');

async function checkSchema() {
  try {
    await db.sequelize.authenticate();
    console.log('Database connected\n');

    const result = await db.sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'thumbnails'
      ORDER BY ordinal_position
    `);

    console.log('Thumbnails table schema:');
    console.log('========================\n');
    result[0].forEach(col => {
      console.log(`${col.column_name.padEnd(20)} ${col.data_type.padEnd(15)} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULLABLE'.padEnd(8)} ${col.column_default || ''}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkSchema();

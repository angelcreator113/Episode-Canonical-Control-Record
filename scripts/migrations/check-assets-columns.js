const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  'episode_metadata',
  'postgres',
  'Ayanna123!!',
  {
    host: 'episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com',
    port: 5432,
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    logging: false,
  }
);

async function checkAssetsTable() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    // Query to get all columns in assets table
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'assets'
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 Columns in assets table:');
    console.log('================================');
    columns.forEach(col => {
      console.log(`${col.column_name.padEnd(30)} | ${col.data_type.padEnd(20)} | nullable: ${col.is_nullable}`);
    });
    console.log(`\n✅ Total columns: ${columns.length}`);

    // Check specifically for 'name' column
    const hasName = columns.find(col => col.column_name === 'name');
    console.log(`\n🔍 'name' column exists: ${hasName ? '✅ YES' : '❌ NO'}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

checkAssetsTable();

const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL || 'postgresql://postgres:Ayanna123!!@episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com:5432/episode_metadata', {
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: false
});

async function checkSchema() {
  try {
    console.log('📋 Checking wardrobe and outfit_sets tables schema...\n');

    // Check wardrobe table
    const [wardrobeColumns] = await sequelize.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'wardrobe' 
      ORDER BY ordinal_position;
    `);

    console.log('Wardrobe table columns:');
    wardrobeColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });
    console.log();

    // Check outfit_sets table
    const [outfitColumns] = await sequelize.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'outfit_sets' 
      ORDER BY ordinal_position;
    `);

    console.log('Outfit_sets table columns:');
    outfitColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });
    console.log();

    // Check if tables exist
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('All tables in database:');
    tables.forEach(t => console.log(`  - ${t.table_name}`));
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkSchema();

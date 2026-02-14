require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'episode_metadata_dev',
  logging: false,
});

async function checkSchema() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    
    // Check thumbnails table schema
    const [thumbnailColumns] = await sequelize.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'thumbnails'
      ORDER BY column_name;
    `);
    
    console.log('\n=== Thumbnails Table All Columns ===');
    console.table(thumbnailColumns);
    
    // Check for episodeId specifically
    const episodeIdCol = thumbnailColumns.find(col => col.column_name === 'episodeId');
    if (episodeIdCol) {
      console.log('\n✓ episodeId column found:', episodeIdCol);
    } else {
      console.log('\n✗ episodeId column NOT found in thumbnails table');
    }
    
    // Check for any thumbnail records
    const [thumbnailCount] = await sequelize.query(`
      SELECT COUNT(*) as count FROM thumbnails;
    `);
    
    console.log('\n=== Thumbnail Records ===');
    console.log('Count:', thumbnailCount[0].count);
    
    // Check scenes table
    const [sceneColumns] = await sequelize.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'scenes'
      AND column_name IN ('id', 'episode_id', 'thumbnail_id')
      ORDER BY column_name;
    `);
    
    console.log('\n=== Scenes Table Key Columns ===');
    console.table(sceneColumns);
    
    await sequelize.close();
    console.log('\n✓ Check complete');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkSchema();

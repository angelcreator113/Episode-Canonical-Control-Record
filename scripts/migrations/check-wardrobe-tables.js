const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  'episode_metadata',
  'postgres',
  'Ayanna123!!',
  {
    host: 'episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com',
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  }
);

async function checkTables() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Check if wardrobe table exists
    const [wardrobeExists] = await sequelize.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'wardrobe')"
    );
    console.log('Wardrobe table exists:', wardrobeExists[0].exists);

    // Check if episode_wardrobe table exists
    const [episodeWardrobeExists] = await sequelize.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'episode_wardrobe')"
    );
    console.log('Episode_wardrobe table exists:', episodeWardrobeExists[0].exists);

    // If episode_wardrobe exists, check its structure
    if (episodeWardrobeExists[0].exists) {
      const [columns] = await sequelize.query(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'episode_wardrobe' ORDER BY ordinal_position"
      );
      console.log('\nEpisode_wardrobe columns:');
      columns.forEach(col => console.log(`  ${col.column_name}: ${col.data_type}`));
    }

    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkTables();

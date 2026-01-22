const { Sequelize } = require('sequelize');
const fs = require('fs');

const sequelize = new Sequelize(
  'episode_metadata',
  'postgres',
  'Ayanna123!!',
  {
    host: 'episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com',
    dialect: 'postgres',
    logging: console.log,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  }
);

async function createTables() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Create episode_wardrobe
    console.log('Creating episode_wardrobe...');
    const wardrobeSQL = fs.readFileSync('create-episode-wardrobe-table.sql', 'utf8');
    await sequelize.query(wardrobeSQL);
    console.log('✅ episode_wardrobe created\n');

    // Create episode_assets and fix episode_scripts
    console.log('Creating episode_assets and fixing episode_scripts...');
    const junctionSQL = fs.readFileSync('create-missing-junction-tables.sql', 'utf8');
    await sequelize.query(junctionSQL);
    console.log('✅ episode_assets created and episode_scripts fixed\n');

    // Verify
    console.log('Verification:');
    const tables = ['episode_wardrobe', 'episode_assets', 'episode_scripts'];
    for (const table of tables) {
      const [exists] = await sequelize.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${table}')`
      );
      console.log(`${table}: ${exists[0].exists ? '✅' : '❌'}`);
    }

    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createTables();

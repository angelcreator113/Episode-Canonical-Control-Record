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

async function checkJunctionTables() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    const tables = ['episode_wardrobe', 'episode_assets', 'episode_scripts'];
    
    for (const table of tables) {
      const [exists] = await sequelize.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${table}')`
      );
      console.log(`${table}: ${exists[0].exists ? '✅ EXISTS' : '❌ MISSING'}`);
      
      if (exists[0].exists) {
        const [columns] = await sequelize.query(
          `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${table}' ORDER BY ordinal_position`
        );
        columns.forEach(col => console.log(`  - ${col.column_name}: ${col.data_type}`));
      }
      console.log('');
    }

    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkJunctionTables();

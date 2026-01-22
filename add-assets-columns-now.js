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

async function addColumns() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    const sql = fs.readFileSync('add-missing-assets-columns.sql', 'utf8');
    await sequelize.query(sql);
    
    console.log('✅ Missing columns added\n');

    // Verify
    const [columns] = await sequelize.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'assets' AND column_name IN ('name', 'asset_group', 'purpose', 's3_url_raw', 's3_url_processed')"
    );
    console.log('Verified columns:', columns.map(c => c.column_name));

    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

addColumns();

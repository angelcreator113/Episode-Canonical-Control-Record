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

async function createTable() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    const sql = fs.readFileSync('create-episode-wardrobe-table.sql', 'utf8');
    console.log('📝 Running SQL script...\n');
    
    await sequelize.query(sql);
    
    console.log('✅ episode_wardrobe table created successfully');
    
    // Verify
    const [result] = await sequelize.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'episode_wardrobe' ORDER BY ordinal_position"
    );
    console.log('\nTable structure:');
    result.forEach(col => console.log(`  ${col.column_name}: ${col.data_type}`));

    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createTable();

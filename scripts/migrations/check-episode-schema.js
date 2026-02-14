require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'episode_metadata',
  logging: false,
});

async function checkEpisodeSchema() {
  try {
    console.log('Checking episodes table schema...\n');
    
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'episodes'
      ORDER BY ordinal_position;
    `);
    
    console.log('Episodes columns:');
    console.table(columns.map(c => ({ name: c.column_name, type: c.data_type, nullable: c.is_nullable })));
    
    // Check if status column exists
    const statusCol = columns.find(c => c.column_name === 'status');
    console.log('\nStatus column exists:', !!statusCol);
    
    // Check if episode_status column exists  
    const episodeStatusCol = columns.find(c => c.column_name === 'episode_status');
    console.log('episode_status column exists:', !!episodeStatusCol);
    
   await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkEpisodeSchema();

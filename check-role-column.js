const { Sequelize } = require('sequelize');

const db = new Sequelize(
  process.env.DB_NAME || 'episode_metadata',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'Ayanna123',
  {
    host: process.env.DB_HOST || '127.0.0.1',
    dialect: 'postgres',
    logging: false,
  }
);

db.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'assets' 
  AND column_name LIKE '%role%'
`)
  .then(([results]) => {
    console.log('Asset role columns:', JSON.stringify(results, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });

const { Sequelize } = require('sequelize');

const db = new Sequelize(
  'episode_metadata',
  'postgres',
  'Ayanna123',
  {
    host: '127.0.0.1',
    dialect: 'postgres',
    logging: false,
  }
);

db.query(`
  SELECT 
    id, 
    name,
    asset_type,
    asset_role,
    asset_group,
    created_at
  FROM assets 
  ORDER BY created_at DESC 
  LIMIT 10
`)
  .then(([results]) => {
    console.log('\nMost recent assets:\n');
    results.forEach(asset => {
      console.log(`ID: ${asset.id}`);
      console.log(`Name: ${asset.name}`);
      console.log(`Type: ${asset.asset_type}`);
      console.log(`Role: ${asset.asset_role || '(NULL)'}`);
      console.log(`Group: ${asset.asset_group || '(NULL)'}`);
      console.log(`Created: ${asset.created_at}`);
      console.log('---');
    });
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
